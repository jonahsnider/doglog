import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { Browser, Page } from 'playwright-core';
import type { onCLS, onLCP } from 'web-vitals';

export type ChromeTarget = { app: 'studio' | 'lite'; version: string; url: string };
type StartupVitals = { mainFrameLcpMs: number | null; mainFrameCls: number };
type BenchmarkGlobals = typeof globalThis & {
	webVitals: { onCLS: typeof onCLS; onLCP: typeof onLCP };
	__doglogBenchmarkVitals: StartupVitals;
};

export function chromeTargets(inputs: string[]): ChromeTarget[] {
	const targets: ChromeTarget[] = [];
	for (let i = 0; i < inputs.length; i += 3) {
		const [app, version, inputUrl] = inputs.slice(i, i + 3);
		if ((app !== 'studio' && app !== 'lite') || !version || !inputUrl) {
			throw new Error('Each Chrome target needs an app (studio or lite), version, and URL.');
		}
		const url = new URL(inputUrl);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Expected an HTTP(S) URL.');
		targets.push({ app, version, url: url.href });
	}
	return targets;
}

function observeVitals() {
	const page = globalThis as BenchmarkGlobals;
	const vitals: StartupVitals = { mainFrameLcpMs: null, mainFrameCls: 0 };
	page.__doglogBenchmarkVitals = vitals;
	page.webVitals.onLCP(
		({ value }) => {
			vitals.mainFrameLcpMs = value;
		},
		{ reportAllChanges: true },
	);
	page.webVitals.onCLS(
		({ value }) => {
			vitals.mainFrameCls = value;
		},
		{ reportAllChanges: true },
	);
}

const vitalsSource = await readFile(createRequire(import.meta.url).resolve('web-vitals'), 'utf8');
const initScript = `if (window === window.top) {\n${vitalsSource}\n(${observeVitals.toString()})();\n}`;

export const liteWorkspace = 'iframe.hub-frame:not(.background)';

export async function newChromeContext(
	browser: Browser,
	target: ChromeTarget,
	storageState?: Awaited<ReturnType<import('playwright-core').BrowserContext['storageState']>>,
) {
	const betaYear =
		target.app === 'lite' ? /^v?(\d+)\.\d+\.\d+-(?:alpha|beta)(?:-|$)/u.exec(target.version)?.[1] : undefined;
	// Seed only the welcome acknowledgement, not cookies, assets or the HTTP cache.
	const origins =
		betaYear === undefined
			? []
			: [
					{
						origin: new URL(target.url).origin,
						localStorage: [
							{ name: `AdvantageScopeLite/beta-${2000 + Number(betaYear)}`, value: '{"welcomeComplete":true}' },
						],
					},
				];
	return browser.newContext({
		viewport: { width: 1280, height: 800 },
		colorScheme: 'light',
		locale: 'en-US',
		storageState: storageState ?? { cookies: [], origins },
	});
}

export async function waitForChromeReady(page: Page, target: ChromeTarget) {
	return page.waitForFunction(
		({ app, liteWorkspace }) => {
			const visible = (element: Element | null | undefined) =>
				element?.checkVisibility({ opacityProperty: true, visibilityProperty: true });
			const enabled = (button: HTMLButtonElement) => !button.matches(':disabled, [aria-disabled="true"]');
			if (app === 'studio') {
				return [...document.querySelectorAll('button')].some(
					(button) => button.textContent?.trim() === 'New dashboard' && visible(button) && enabled(button),
				)
					? performance.now()
					: 0;
			}
			const frame = document.querySelector<HTMLIFrameElement>(liteWorkspace);
			const button = frame?.contentDocument?.querySelector<HTMLButtonElement>('button.tab-control.add-tab');
			return visible(frame) && button && visible(button) && enabled(button) ? performance.now() : 0;
		},
		{ app: target.app, liteWorkspace },
	);
}

export async function measureChromeStartup(browser: Browser, target: ChromeTarget) {
	const context = await newChromeContext(browser, target);
	try {
		await context.addInitScript({ content: initScript });
		const page = await context.newPage();
		const response = await page.goto(target.url, { waitUntil: 'commit' });
		if (!response?.ok()) throw new Error(`Navigation failed: HTTP ${response?.status() ?? 'no response'}`);
		const ready = await waitForChromeReady(page, target);
		const readyMs = await ready.jsonValue();
		// Allow late startup paints/shifts without including the observation wait in readyMs.
		await page.waitForFunction((end) => performance.now() >= end, Math.max(5_000, readyMs + 500));
		const vitals = await page.evaluate(() => {
			if (performance.getEntriesByType('visibility-state').some(({ name }) => name === 'hidden')) {
				throw new Error('Chrome hid the benchmark page during startup.');
			}
			return (globalThis as BenchmarkGlobals).__doglogBenchmarkVitals;
		});
		return { readyMs, ...vitals };
	} finally {
		await context.close();
	}
}
