import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempDisposableSync } from 'node:fs';
import { arch, cpus, release, tmpdir, type } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMacApp } from './macos-app.ts';

const [mode, runs, ...inputs] = process.argv.slice(2);
const count = Number(runs);
const usage = `Usage from the repo root:
  pnpm --silent --filter @doglog/benchmarks startup:macos <runs> <app.app> [<app.app> ...]
  pnpm --silent --filter @doglog/benchmarks startup:chrome <runs> <studio|lite> <version> <url> [<studio|lite> <version> <url> ...]
  See suite --help for the Chrome WPILOG benchmark.`;

function command(executable: string, args: string[]) {
	const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 45_000 });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(result.stderr.trim() || `${executable} exited with ${result.status}`);
	return result.stdout.trim();
}

async function runSamples<T extends { app: string; version: string }>(
	targets: T[],
	measure: (target: T) => Record<string, number | null> | Promise<Record<string, number | null>>,
) {
	const machine = { os: `${type()} ${release()}`, arch: arch(), cpu: cpus()[0]?.model };
	for (let run = 1; run <= count; run++) {
		// Alternate app order so neither always goes first.
		for (const target of run % 2 === 0 ? targets.toReversed() : targets) {
			const sample = {
				benchmark: mode === 'wpilog' ? 'wpilog:chrome' : `startup:${mode}`,
				run,
				timestamp: new Date().toISOString(),
				...machine,
				...target,
			};
			try {
				console.log(JSON.stringify({ ...sample, ...(await measure(target)) }));
			} catch (error) {
				console.log(JSON.stringify({ ...sample, error: error instanceof Error ? error.message : String(error) }));
				process.exitCode = 1;
				return;
			}
		}
	}
}

async function macOSStartup() {
	if (process.platform !== 'darwin') throw new Error('The macOS startup benchmark requires macOS.');
	const targets = inputs.map((path) => {
		const { app, bundleID, version, build } = readMacApp(resolve(process.env['INIT_CWD'] ?? process.cwd(), path));
		return { app, bundleID, version, build };
	});

	using scratch = mkdtempDisposableSync(join(tmpdir(), 'doglog-bench-'));
	const probe = join(scratch.path, 'macos-startup');
	command('/usr/bin/swiftc', [fileURLToPath(new URL('macos-startup.swift', import.meta.url)), '-o', probe]);
	await runSamples(targets, ({ app, bundleID }) => {
		const firstWindowMs = Number(command(probe, [app, bundleID]));
		if (!Number.isFinite(firstWindowMs) || firstWindowMs <= 0) throw new Error('The macOS probe returned no timing.');
		return { firstWindowMs };
	});
}

try {
	if (runs === '--help') {
		console.log(usage);
	} else if (!Number.isSafeInteger(count) || count < 1 || inputs.length === 0) {
		throw new Error(usage);
	} else if (mode === 'macos') {
		await macOSStartup();
	} else if (mode === 'chrome' || mode === 'wpilog') {
		const { chromeTargets, measureChromeStartup } = await import('./chrome-startup.ts');
		const [path, signal] = inputs;
		const targets = chromeTargets(mode === 'wpilog' ? inputs.slice(2) : inputs);
		const { chromium } = await import('playwright-core');
		const browser = await chromium.launch({ channel: 'chrome', headless: false });
		try {
			const browserTargets = targets.map((target) => ({ ...target, browserVersion: browser.version() }));
			if (mode === 'wpilog') {
				if (!path || !signal || !targets.length) throw new Error(usage);
				const { measureOpenGraph, prepareGraph, readWpilogFixture, serveWpilogFixture } =
					await import('./chrome-open-graph.ts');
				const { bytes, ...fixture } = await readWpilogFixture(path, signal);
				const { url, server } = await serveWpilogFixture(bytes, targets);
				try {
					const graphs = new Map<string, Awaited<ReturnType<typeof prepareGraph>>>();
					await runSamples(
						browserTargets.map((target) => ({ ...target, ...fixture })),
						async (target) => {
							let graph = graphs.get(target.app);
							if (!graph) {
								try {
									graph = await prepareGraph(browser, target, url, signal);
								} catch (error) {
									throw new Error(
										`Could not prepare the ${target.app} graph for ${signal}: ${error instanceof Error ? error.message : String(error)}`,
									);
								}
								graphs.set(target.app, graph);
							}
							return measureOpenGraph(browser, target, url, graph);
						},
					);
				} finally {
					await once(server.close(), 'close');
				}
			} else {
				await runSamples(browserTargets, (target) => measureChromeStartup(browser, target));
			}
		} finally {
			await browser.close();
		}
	} else {
		throw new Error(usage);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
