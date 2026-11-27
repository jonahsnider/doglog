import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempDisposableSync } from 'node:fs';
import { appendFile, mkdir, mkdtemp, open, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  --only macos|chrome|size|wpilog  Run just one group of checks
  --runs <count>           Timed samples per app (default: 10)
  --wpilog <path>          Include Chrome open-to-graph using a local WPILOG
  --signal <entry>         Full numeric entry path in that log (required with --wpilog)
  --studio-dmg <path>      Studio installer matching the installed app
  --advantagescope-dmg <path>  AdvantageScope installer matching the installed app
  --lite-run <id>          Override the Lite GitHub Actions run ID
  --lite-version <tag>     Version label for that Lite build (required with --lite-run)
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

async function suite() {
	const { values } = parseArgs({
		options: {
			only: { type: 'string' },
			runs: { type: 'string', default: '10' },
			wpilog: { type: 'string' },
			signal: { type: 'string' },
			'studio-dmg': { type: 'string' },
			'advantagescope-dmg': { type: 'string' },
			'lite-run': { type: 'string' },
			'lite-version': { type: 'string' },
			help: { type: 'boolean' },
		},
	});
	if (values.help) {
		console.log(usage);
		return;
	}
	const { only, runs, wpilog, signal } = values;
	const cwd = process.env['INIT_CWD'] ?? process.cwd();
	const chromeStartup = only === undefined || only === 'chrome';
	const macSize = only === undefined || only === 'macos' || only === 'size';
	const studioDmg = values['studio-dmg'];
	const scopeDmg = values['advantagescope-dmg'];
	const liteRun = values['lite-run'] ?? defaultLite.run;
	const liteVersion = values['lite-version'] ?? defaultLite.version;
	if (
		(only !== undefined && !['macos', 'chrome', 'size', 'wpilog'].includes(only)) ||
		!/^[1-9]\d*$/u.test(runs) ||
		!Number.isSafeInteger(Number(runs)) ||
		(values['lite-run'] === undefined) !== (values['lite-version'] === undefined) ||
		!/^[1-9]\d*$/u.test(liteRun) ||
		!liteVersion.trim()
	) {
		throw new Error(usage);
	}
	if ((studioDmg !== undefined || scopeDmg !== undefined) && (!studioDmg || !scopeDmg || !macSize)) {
		throw new Error('Pass both DMG paths together for a macOS size check.');
	}
	if (
		(wpilog !== undefined || signal !== undefined || only === 'wpilog') &&
		(!wpilog || !signal || (macSize && only !== undefined))
	) {
		throw new Error('Pass --wpilog and --signal together for a Chrome WPILOG check.');
	}
	if (process.platform !== 'darwin') throw new Error('Run the benchmark suite in a logged-in macOS desktop session.');

	const resultsDir = join(benchmarkDir, 'results');
	await mkdir(resultsDir, { recursive: true });
	const outputDir = await mkdtemp(join(resultsDir, `${new Date().toISOString().replaceAll(':', '-')}-`));
	console.log(`Results: ${outputDir}`);
	const files: string[] = [];
	const failures: string[] = [];

	async function measure(mode: 'macos' | 'chrome' | 'wpilog', args: string[]) {
		const path = join(outputDir, mode === 'wpilog' ? 'chrome-wpilog.jsonl' : `${mode}-startup.jsonl`);
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

	if (only === undefined || only === 'macos') {
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
	if (chromeStartup || wpilog) {
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
				if (wpilog && signal) {
					await attempt('Chrome WPILOG', () => measure('wpilog', [resolve(cwd, wpilog), signal, ...targets]));
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
