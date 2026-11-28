import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempDisposableSync } from 'node:fs';
import { appendFile, cp, mkdir, mkdtemp, open, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { measureMacAppSize } from './macos-app.ts';

const benchmarkDir = import.meta.dirname;
const repoDir = join(benchmarkDir, '..');
const studioDir = join(repoDir, 'studio');
const host = '127.0.0.1';
const studioPort = 4173;
const litePort = 5808;
const defaultLite = { run: '45524166211', version: 'v27.0.0-beta-1' };
const macApps = ['/Applications/DogLog Studio.app', '/Applications/AdvantageScope.app'];

const usage = `Usage: pnpm --filter @doglog/benchmarks suite [options]
  --only macos|chrome|size|wpilog|wpilog-local|field  Run just one group of checks
  --runs <count>           Timed samples per app (default: 10)
  --wpilog <path>          WPILOG fixture for open-to-graph checks
  --signal <entry>         Full numeric entry path in that log (required with --wpilog)
  --fixtures <json>        Run a list of WPILOG and HOOT fixtures; includes local-file runs on macOS
  --local-file             Include macOS local-file WPILOG in a full suite run
  --studio-dmg <path>      Studio installer matching the installed app
  --advantagescope-dmg <path>  AdvantageScope installer matching the installed app
  --lite-dir <path>        Use an unpacked Lite artifact instead of downloading it
  --lite-run <id>          Override the Lite GitHub Actions run ID
  --lite-version <tag>      Version label (required with --lite-dir or --lite-run)
  --help                   Show this message`;

type CommandOptions = { cwd?: string; env?: NodeJS.ProcessEnv; stdout?: number; stderr?: number };
const children = new Set<ChildProcess>();
let scratch: ReturnType<typeof mkdtempDisposableSync> | undefined;

function start(command: string, args: string[], { cwd = repoDir, env, stdout, stderr }: CommandOptions = {}) {
	const child = spawn(command, args, {
		cwd,
		env,
		stdio: ['ignore', stdout ?? 'inherit', stderr ?? 'inherit'],
		detached: true,
	});
	children.add(child);
	return child;
}

function stop(child: ChildProcess) {
	children.delete(child);
	if (child.pid === undefined) return;
	try {
		// Stop the server as well as its pnpm or uv launcher.
		process.kill(-child.pid, 'SIGTERM');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ESRCH') console.error(error);
	}
}

async function run(command: string, args: string[], options?: CommandOptions) {
	const child = start(command, args, options);
	try {
		const [code, signal] = await once(child, 'exit');
		if (code !== 0) throw new Error(`${command} ${args[0]} exited with ${signal ?? code}.`);
	} finally {
		children.delete(child);
	}
}

async function checkPort(port: number) {
	const socket = createServer().listen(port, host);
	try {
		await once(socket, 'listening');
	} catch (error) {
		throw new Error(`Cannot listen on ${host}:${port}: ${message(error)}`);
	}
	await once(socket.close(), 'close');
}

async function waitForServer(server: ChildProcess, url: string) {
	let spawnError: Error | undefined;
	server.once('error', (error) => (spawnError = error));
	const deadline = performance.now() + 30_000;
	while (performance.now() < deadline) {
		if (spawnError) throw spawnError;
		if (server.exitCode !== null || server.signalCode !== null)
			throw new Error(`Server exited before ${url} was ready.`);
		const response = await fetch(url, { signal: AbortSignal.timeout(1_000) }).catch(() => undefined);
		if (response) {
			await response.body?.cancel();
			if (response.ok) return;
		}
		await setTimeout(200);
	}
	throw new Error(`Timed out waiting for ${url}.`);
}

function message(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

type Fixture = { path: string; signal: string; scopeSignal: string };

async function readFixtures(path: string): Promise<Fixture[]> {
	const entries: unknown = JSON.parse(await readFile(path, 'utf8'));
	if (!Array.isArray(entries) || entries.length === 0)
		throw new Error(`${path}: expected a nonempty array of fixtures.`);
	return entries.map((entry: unknown, i) => {
		const fixture = entry as Partial<Fixture> | null;
		if (
			!fixture ||
			typeof fixture.path !== 'string' ||
			!['.wpilog', '.hoot'].includes(extname(fixture.path)) ||
			typeof fixture.signal !== 'string' ||
			!fixture.signal.trim() ||
			(fixture.scopeSignal !== undefined &&
				(extname(fixture.path) !== '.hoot' || typeof fixture.scopeSignal !== 'string' || !fixture.scopeSignal.trim()))
		) {
			throw new Error(`${path}: fixture ${i + 1} needs a .wpilog or .hoot path and signal; scopeSignal is HOOT-only.`);
		}
		return {
			path: resolve(dirname(path), fixture.path),
			signal: fixture.signal,
			scopeSignal: fixture.scopeSignal ?? fixture.signal,
		};
	});
}

async function suite() {
	const { values } = parseArgs({
		options: {
			only: { type: 'string' },
			runs: { type: 'string', default: '10' },
			wpilog: { type: 'string' },
			signal: { type: 'string' },
			fixtures: { type: 'string' },
			'local-file': { type: 'boolean' },
			'studio-dmg': { type: 'string' },
			'advantagescope-dmg': { type: 'string' },
			'lite-dir': { type: 'string' },
			'lite-run': { type: 'string' },
			'lite-version': { type: 'string' },
			help: { type: 'boolean' },
		},
	});
	if (values.help) {
		console.log(usage);
		return;
	}
	const { only, runs, wpilog, signal, fixtures: fixtureList } = values;
	const cwd = process.env['INIT_CWD'] ?? process.cwd();
	const darwin = process.platform === 'darwin';
	const chromeStartup = only === undefined || only === 'chrome';
	const chromeField = chromeStartup || only === 'field';
	const macStartup = darwin && (only === undefined || only === 'macos');
	const macLocal =
		only === 'wpilog-local' || values['local-file'] === true || (macStartup && !!(fixtureList || (only && wpilog)));
	const macSize = darwin && (only === undefined || only === 'macos' || only === 'size');
	const studioDmg = values['studio-dmg'];
	const scopeDmg = values['advantagescope-dmg'];
	const liteSource = values['lite-dir'];
	const liteRun = values['lite-run'] ?? defaultLite.run;
	const liteVersion = values['lite-version'] ?? defaultLite.version;
	if (
		(only !== undefined && !['macos', 'chrome', 'size', 'wpilog', 'wpilog-local', 'field'].includes(only)) ||
		(only !== undefined && values['local-file'] === true) ||
		!/^[1-9]\d*$/u.test(runs) ||
		!Number.isSafeInteger(Number(runs)) ||
		(liteSource !== undefined && (!liteSource.trim() || values['lite-run'] !== undefined)) ||
		(liteSource !== undefined || values['lite-run'] !== undefined) !== (values['lite-version'] !== undefined) ||
		!/^[1-9]\d*$/u.test(liteRun) ||
		!liteVersion.trim()
	) {
		throw new Error(usage);
	}
	if ((studioDmg !== undefined || scopeDmg !== undefined) && (!studioDmg || !scopeDmg || !macSize)) {
		throw new Error('Pass both DMG paths together for a macOS size check.');
	}
	if (!darwin && (only === 'macos' || only === 'size' || macLocal)) {
		throw new Error('Desktop benchmarks require a logged-in macOS session.');
	}
	if (
		(fixtureList !== undefined && (wpilog !== undefined || signal !== undefined)) ||
		((wpilog !== undefined || signal !== undefined) && (!wpilog?.endsWith('.wpilog') || !signal?.trim()))
	) {
		throw new Error('Use --fixtures, or pass one .wpilog with --wpilog and --signal.');
	}
	const fixtures =
		fixtureList !== undefined
			? await readFixtures(resolve(cwd, fixtureList))
			: wpilog && signal
				? [{ path: resolve(cwd, wpilog), signal, scopeSignal: signal }]
				: [];
	const chromeLogs =
		chromeStartup || only === 'wpilog' ? fixtures.filter(({ path }) => extname(path) === '.wpilog') : [];
	if (
		(only === 'wpilog' && !chromeLogs.length) ||
		(macLocal && !fixtures.length) ||
		(fixtures.length && !macLocal && !chromeLogs.length)
	) {
		throw new Error(
			'Pass fixtures supported by the selected log benchmark (.wpilog for Chrome, .wpilog or .hoot for macOS).',
		);
	}

	const resultsDir = join(benchmarkDir, 'results');
	await mkdir(resultsDir, { recursive: true });
	const outputDir = await mkdtemp(join(resultsDir, `${new Date().toISOString().replaceAll(':', '-')}-`));
	console.log(`Results: ${outputDir}`);
	const files: string[] = [];
	const failures: string[] = [];
	const skips: string[] = [];
	if (!only && !darwin) skips.push('Desktop benchmarks require macOS.');
	if ((chromeStartup || only === 'wpilog') && fixtures.some(({ path }) => extname(path) === '.hoot')) {
		skips.push('HOOT is measured with the native desktop picker, not Chrome’s WPILOG URL path.');
	}
	if (!only && !fixtures.length) skips.push('Log workloads require --fixtures or --wpilog with --signal.');

	async function measure(
		mode: 'macos' | 'chrome' | 'wpilog' | 'wpilog-local' | 'field',
		args: string[],
		file = `${mode}-startup`,
	) {
		const path = join(outputDir, `${file}.jsonl`);
		await using output = await open(path, 'w');
		try {
			await run(process.execPath, [join(benchmarkDir, 'startup.ts'), mode, runs, ...args], { stdout: output.fd });
		} finally {
			if ((await output.stat()).size > 0) files.push(path);
		}
	}

	async function attempt(label: string, benchmark: () => Promise<void>) {
		console.log(`\n${label}`);
		try {
			await benchmark();
		} catch (error) {
			const failure = `${label}: ${message(error)}`;
			failures.push(failure);
			console.error(failure);
		}
	}

	if (macStartup) {
		await attempt('macOS startup', () => measure('macos', macApps));
	}
	if (macSize) {
		await attempt('macOS size', async () => {
			const installers = [studioDmg, scopeDmg];
			const samples = macApps.map((app, i) => {
				const installer = installers[i];
				return measureMacAppSize(app, installer === undefined ? undefined : resolve(cwd, installer));
			});
			const path = join(outputDir, 'macos-size.jsonl');
			await writeFile(path, samples.map((sample) => JSON.stringify(sample)).join('\n') + '\n');
			files.push(path);
		});
	}
	if (macLocal) {
		for (const [i, { path, signal, scopeSignal }] of fixtures.entries()) {
			const format = extname(path).slice(1);
			await attempt(`macOS local file: ${basename(path)}`, () =>
				measure('wpilog-local', [path, signal, scopeSignal, ...macApps], `macos-${format}-${i + 1}`),
			);
		}
	}
	if (chromeField || chromeLogs.length) {
		await attempt('Chrome setup', async () => {
			await checkPort(studioPort);
			await checkPort(litePort);
			scratch = mkdtempDisposableSync(join(tmpdir(), 'doglog-benchmark-suite-'));
			const distDir = join(scratch.path, 'studio');
			const liteDir = join(scratch.path, 'lite');
			const env = { ...process.env, SENTRY_AUTH_TOKEN: '' };
			const studioVersion = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
				cwd: repoDir,
				encoding: 'utf8',
			}).trim();
			console.log('Building Studio for production.');
			await run('pnpm', ['build', '--outDir', distDir, '--logLevel', 'warn'], { cwd: studioDir, env });
			if (liteSource !== undefined) {
				console.log(`Using local AdvantageScope Lite ${liteVersion}.`);
				await cp(resolve(cwd, liteSource), liteDir, { recursive: true });
			} else {
				console.log(`Downloading AdvantageScope Lite ${liteVersion} (run ${liteRun}).`);
				await run('gh', [
					'run',
					'download',
					liteRun,
					'-R',
					'Mechanical-Advantage/AdvantageScope',
					'-n',
					'advantagescopelite-desktop',
					'-D',
					liteDir,
				]);
			}

			const liteServer = join(liteDir, 'lite_server.py');
			const source = await readFile(liteServer, 'utf8');
			// The downloaded server listens on all interfaces and has no CLI option for the address.
			const bind = 'socketserver.ThreadingTCPServer(("", PORT),';
			if (!source.includes(bind)) throw new Error('The Lite server no longer uses the expected listen address.');
			await writeFile(liteServer, source.replace(bind, `socketserver.ThreadingTCPServer(("${host}", PORT),`));

			const studioUrl = `http://${host}:${studioPort}/`;
			const liteUrl = `http://${host}:${litePort}/`;
			const servers: ChildProcess[] = [];
			await using liteLog = await open(join(outputDir, 'lite-server.log'), 'w');
			try {
				const studio = start(
					'pnpm',
					['preview', '--host', host, '--port', String(studioPort), '--strictPort', '--outDir', distDir],
					{
						cwd: studioDir,
						env,
					},
				);
				servers.push(studio);
				await waitForServer(studio, studioUrl);
				const lite = start('uv', ['run', '--no-project', '--with', 'multipart==1.3.0', 'python', 'lite_server.py'], {
					cwd: liteDir,
					stdout: liteLog.fd,
					stderr: liteLog.fd,
				});
				servers.push(lite);
				await waitForServer(lite, liteUrl);
				const targets = ['studio', studioVersion, studioUrl, 'lite', liteVersion, liteUrl];
				if (chromeStartup) await attempt('Chrome startup', () => measure('chrome', targets));
				if (chromeField) await attempt('Chrome 3D field', () => measure('field', targets, 'chrome-field'));
				for (const [i, { path, signal }] of chromeLogs.entries()) {
					await attempt(`Chrome URL: ${basename(path)}`, () =>
						measure('wpilog', [path, signal, ...targets], `chrome-wpilog-${i + 1}`),
					);
				}
			} finally {
				for (const server of servers) stop(server);
			}
		});
	}

	const report = join(outputDir, 'benchmark-report.md');
	if (files.length) {
		await using output = await open(report, 'w');
		await run(process.execPath, [join(benchmarkDir, 'report.ts'), ...files], { stdout: output.fd });
	} else {
		await writeFile(report, '# Benchmark comparison\n\nNo samples collected.\n');
	}
	if (failures.length) {
		await appendFile(report, `\n## Incomplete benchmarks\n\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
		process.exitCode = 1;
	}
	if (skips.length) await appendFile(report, `\n## Not run\n\n${skips.map((skip) => `- ${skip}`).join('\n')}\n`);
	console.log(`\nReport: ${report}`);
}

process.once('exit', () => {
	for (const child of children) stop(child);
	scratch?.remove();
});
process.once('SIGINT', () => process.exit(130));
process.once('SIGTERM', () => process.exit(143));

try {
	await suite();
} catch (error) {
	console.error(message(error));
	process.exitCode = 1;
}
