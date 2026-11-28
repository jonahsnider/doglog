import { once } from 'node:events';
import { createServer } from 'node:http';
import { type Browser, type BrowserContext, errors, type Page } from 'playwright-core';
import { type ChromeTarget, liteWorkspace, newChromeContext, waitForChromeReady } from './chrome-startup.ts';

const fixtureName = 'benchmark.wpilog';
const fixturePath = `/logs/${fixtureName}`;
const openMark = 'benchmark:open-log';
const graphMark = 'benchmark:graph-drawn';
const rafGapMeasure = 'benchmark:open-graph-max-raf-gap';
const timeout = 60_000;

export async function serveWpilogFixture(bytes: Buffer, targets: ChromeTarget[]) {
	const origins = new Set(targets.map(({ url }) => new URL(url).origin));
	const server = createServer((request, response) => {
		const origin = request.headers.origin;
		if (request.method !== 'GET' || request.url !== fixturePath || (origin !== undefined && !origins.has(origin))) {
			response.writeHead(404).end();
			return;
		}
		if (origin !== undefined) response.setHeader('Access-Control-Allow-Origin', origin);
		response
			.writeHead(200, {
				'Cache-Control': 'no-store',
				'Content-Type': 'application/octet-stream',
				'Content-Length': bytes.byteLength,
			})
			.end(bytes);
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	if (address === null || typeof address === 'string') throw new Error('Could not bind the log fixture server.');
	return { url: `http://127.0.0.1:${address.port}${fixturePath}`, server };
}

async function routeFixture(context: BrowserContext, target: ChromeTarget, fixtureUrl: string) {
	const url = new URL(fixturePath, target.url);
	await context.route(
		(request) => request.origin === url.origin && request.pathname === url.pathname,
		(route) => route.fulfill({ status: 307, headers: { location: fixtureUrl, 'cache-control': 'no-store' } }),
	);
	return url.href;
}

async function openLog(page: Page, target: ChromeTarget, url: string) {
	if (target.app === 'studio') {
		await page.keyboard.press('ControlOrMeta+Shift+O');
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('textbox', { name: 'Log URL' }).fill(url);
		await dialog.getByRole('button', { name: 'Open', exact: true }).evaluate((button, mark) => {
			performance.mark(mark);
			(button as HTMLButtonElement).click();
		}, openMark);
	} else {
		await page
			.frameLocator(liteWorkspace)
			.locator('body')
			.evaluate(
				(_body, { file, mark }) => {
					const hub = window as typeof window & { sendMainMessage(name: string, data: { files: string[] }): void };
					window.top!.performance.mark(mark);
					hub.sendMainMessage('open-files-request', { files: [file] });
				},
				{ file: fixtureName, mark: openMark },
			);
	}
}

async function watchGraph(page: Page, app: ChromeTarget['app'], sampleCadence = false) {
	const body = app === 'studio' ? page.locator('body') : page.frameLocator(liteWorkspace).locator('body');
	await body.evaluate(
		(_body, { app, openMark, graphMark, sampleCadence, rafGapMeasure }) => {
			const clock = window.top!.performance;
			const callbackTimes: number[] = [];
			let frameRequest: number | undefined;
			function sampleFrame() {
				// Use actual callback delivery time in the same clock as both graph marks.
				callbackTimes.push(clock.now());
				frameRequest = requestAnimationFrame(sampleFrame);
			}
			if (sampleCadence) frameRequest = requestAnimationFrame(sampleFrame);
			let hasSamples = app === 'studio';
			let restoreRenderer: (() => void) | undefined;
			if (app === 'lite') {
				type LineGraphRenderer = { render(command: { leftFields: { values: number[] }[] }): void };
				const { tabs } = window as typeof window & {
					tabs: { getSelectedTab(): number; tabList: { renderer: LineGraphRenderer }[] };
				};
				const renderer = tabs.tabList[tabs.getSelectedTab()]!.renderer;
				const render = renderer.render;
				renderer.render = function (command) {
					// The renderer also issues a series stroke while its lazy-loaded field is still empty.
					hasSamples = command.leftFields.some(({ values }) => values.length > 0);
					render.call(this, command);
				};
				restoreRenderer = () => {
					renderer.render = render;
				};
			}
			const prototype = CanvasRenderingContext2D.prototype;
			const stroke = prototype.stroke;
			prototype.stroke = function (this: CanvasRenderingContext2D, ...args: [Path2D?]) {
				Reflect.apply(stroke, this, args);
				// Distinguish the continuous series from canvas setup, gridlines, and axes.
				let trace: boolean;
				if (app === 'studio') {
					trace =
						this.canvas.matches('.uplot canvas') &&
						args[0] instanceof Path2D &&
						this.lineWidth === 1.5 * devicePixelRatio;
				} else {
					// Lite sets both colors for a numeric series, with theme-adjusted RGB values.
					const color = this.strokeStyle;
					trace =
						hasSamples &&
						this.canvas.matches('.line-graph-canvas') &&
						this.lineCap === 'round' &&
						color === this.fillStyle &&
						typeof color === 'string' &&
						/^#[0-9a-f]{6}$/u.test(color) &&
						(color.slice(1, 3) !== color.slice(3, 5) || color.slice(3, 5) !== color.slice(5, 7));
				}
				if (!trace || !this.canvas.checkVisibility() || this.globalAlpha <= 0) return;
				const open = clock.getEntriesByName(openMark, 'mark')[0];
				if (!open) return;
				const end = clock.mark(graphMark).startTime;
				prototype.stroke = stroke;
				restoreRenderer?.();
				if (frameRequest !== undefined) {
					cancelAnimationFrame(frameRequest);
					// Clip to the workload, including both boundary gaps. If no callback ran, the gap is the whole load.
					let previous = open.startTime;
					let gapStart = previous;
					let gapEnd = previous;
					let count = 0;
					for (const time of callbackTimes) {
						if (time < open.startTime) continue;
						if (time - previous > gapEnd - gapStart) {
							gapStart = previous;
							gapEnd = time;
						}
						previous = time;
						count++;
					}
					if (end - previous > gapEnd - gapStart) {
						gapStart = previous;
						gapEnd = end;
					}
					clock.measure(rafGapMeasure, { start: gapStart, end: gapEnd, detail: count });
				}
			};
		},
		{ app, openMark, graphMark, sampleCadence, rafGapMeasure },
	);
}

async function waitForGraph(page: Page) {
	const result = await page
		.waitForFunction(
			({ openMark, graphMark }) => {
				const end = performance.getEntriesByName(graphMark)[0];
				return end ? { ms: end.startTime - performance.getEntriesByName(openMark)[0]!.startTime } : null;
			},
			{ openMark, graphMark },
			{ timeout },
		)
		.catch((error: unknown) => {
			throw new Error('No numeric line was drawn after opening the log.', { cause: error });
		});
	return (await result.jsonValue())!.ms;
}

async function measurePlayClick(page: Page, app: ChromeTarget['app']) {
	const workspace = app === 'studio' ? page : page.frameLocator(liteWorkspace);
	const play = workspace.locator(
		app === 'studio'
			? 'footer[aria-label="Timeline"] button[aria-label="Play"]'
			: 'button.tab-control.play:not([hidden])',
	);
	const pauseSelector =
		app === 'studio'
			? 'footer[aria-label="Timeline"] button[aria-label="Pause"]'
			: 'button.tab-control.pause:not([hidden])';
	const playMeasure = 'benchmark:play-click-to-pause-control';
	const interactionTimeout = 5_000;
	try {
		await play.evaluate(
			(button, { pauseSelector, playMeasure }) => {
				button.addEventListener(
					'click',
					(event) => {
						if (!event.isTrusted) return;
						// Observe the DOM response in the input's own frame, not a paint or the next animation frame.
						const observer = new MutationObserver(() => {
							if (!document.querySelector(pauseSelector)) return;
							performance.measure(playMeasure, { start: event.timeStamp, end: performance.now() });
							observer.disconnect();
						});
						observer.observe(button.closest('footer') ?? document.body, {
							attributeFilter: ['aria-label', 'hidden'],
							childList: true,
							subtree: true,
						});
					},
					{ capture: true, once: true },
				);
			},
			{ pauseSelector, playMeasure },
			{ timeout: interactionTimeout },
		);
		await play.click({ timeout: interactionTimeout });
		const result = await page.waitForFunction(
			({ frameSelector, playMeasure }) => {
				const source = frameSelector ? document.querySelector<HTMLIFrameElement>(frameSelector)?.contentWindow : window;
				const entry = source?.performance.getEntriesByName(playMeasure, 'measure')[0];
				if (!entry) return false;
				const wasHidden = performance.getEntriesByType('visibility-state').some(({ name }) => name === 'hidden');
				return { ms: wasHidden ? null : entry.duration };
			},
			{ frameSelector: app === 'lite' ? liteWorkspace : null, playMeasure },
			{ timeout: interactionTimeout },
		);
		const sample = await result.jsonValue();
		return sample ? sample.ms : null;
	} catch (error) {
		if (error instanceof errors.TimeoutError) return null;
		throw error;
	}
}

export async function prepareGraph(browser: Browser, target: ChromeTarget, fixtureUrl: string, signal: string) {
	const context = await newChromeContext(browser, target);
	try {
		const url = await routeFixture(context, target, fixtureUrl);
		const page = await context.newPage();
		page.setDefaultTimeout(timeout);
		await page.goto(target.url);
		await waitForChromeReady(page, target);
		if (target.app === 'studio') {
			await page.getByRole('button', { name: 'New dashboard', exact: true }).first().click();
		}
		await watchGraph(page, target.app);
		await openLog(page, target, url);
		if (target.app === 'studio') {
			await page.getByRole('searchbox', { name: 'Search entries' }).fill(signal);
			await page.locator(`[data-value=${JSON.stringify(signal)}][role=treeitem]`).dblclick();
		} else {
			// Lite validates a dropped field against the log index.
			await page.waitForFunction(
				({ liteWorkspace, signal }) => {
					const frame = document.querySelector<HTMLIFrameElement>(liteWorkspace);
					const workspace = frame?.contentWindow as (Window & { log?: { getType(key: string): number | null } }) | null;
					return workspace?.log?.getType(signal) != null;
				},
				{ liteWorkspace, signal },
				{ timeout },
			);
			// Send the graph's normal drop event without depending on sidebar search or pointer hit testing.
			await page
				.frameLocator(liteWorkspace)
				.locator('.line-graph-left:visible')
				.evaluate((list, key) => {
					const { x, y, width, height } = list.getBoundingClientRect();
					window.dispatchEvent(
						new CustomEvent('drag-update', {
							detail: { end: true, x: x + width / 2, y: y + height / 2, data: { fields: [key], children: [] } },
						}),
					);
				}, signal);
		}
		await waitForGraph(page);
		if (target.app === 'lite') {
			await page
				.waitForFunction(
					(signal) =>
						Object.entries(localStorage).some(
							([key, value]) =>
								key.startsWith('AdvantageScopeLite/') &&
								key.endsWith('/state') &&
								value.includes(`"logKey":${JSON.stringify(signal)}`),
						),
					signal,
				)
				.catch((error: unknown) => {
					throw new Error('Lite did not save the graph layout.', { cause: error });
				});
		}
		return { pageUrl: page.url(), storageState: await context.storageState() };
	} finally {
		await context.close();
	}
}

export async function measureOpenGraph(
	browser: Browser,
	target: ChromeTarget,
	fixtureUrl: string,
	graph: Awaited<ReturnType<typeof prepareGraph>>,
) {
	const context = await newChromeContext(browser, target, graph.storageState);
	try {
		const url = await routeFixture(context, target, fixtureUrl);
		const page = await context.newPage();
		page.setDefaultTimeout(timeout);
		await page.goto(graph.pageUrl);
		if (target.app === 'lite') await waitForChromeReady(page, target);
		else await page.getByText('No data', { exact: true }).waitFor();
		await watchGraph(page, target.app, true);
		await openLog(page, target, url);
		const openGraphMs = await waitForGraph(page);
		const cadence = await page.evaluate((rafGapMeasure) => {
			if (performance.getEntriesByType('visibility-state').some(({ name }) => name === 'hidden')) {
				throw new Error('Chrome hid the benchmark page during log loading.');
			}
			const gap = performance.getEntriesByName(rafGapMeasure, 'measure')[0] as PerformanceMeasure | undefined;
			if (gap === undefined) throw new Error('No animation callback cadence was measured.');
			return { openGraphMaxRafGapMs: gap.duration, openGraphRafCallbackCount: gap.detail as number };
		}, rafGapMeasure);
		const playClickToPauseControlMs = await measurePlayClick(page, target.app);
		return { openGraphMs, ...cadence, playClickToPauseControlMs };
	} finally {
		await context.close();
	}
}
