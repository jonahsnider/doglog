// Runs a local Convex backend for this worktree, with Studio's dev server connected to it.
// The first run creates the deployment in `.convex` and `.env.local`, later runs reuse it.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseEnv } from 'node:util';

const cloud = path.join(import.meta.dirname, '..');
const studio = path.join(cloud, '..', 'studio');

function readEnvLocal(): Record<string, string | undefined> {
	try {
		return parseEnv(readFileSync(path.join(cloud, '.env.local'), 'utf8'));
	} catch {
		return {};
	}
}

const configured = readEnvLocal()['CONVEX_DEPLOYMENT'];
if (configured !== undefined && !/^(?:anonymous|local):/u.test(configured)) {
	console.error(
		`cloud/.env.local uses the ${configured} deployment, not a local one. Move it away to run a local backend.`,
	);
	process.exit(1);
}
if (configured === undefined) {
	console.log('Creating a local deployment. Its first push fails until its environment variables are set below.');
}

const children: ChildProcess[] = [];
function run(command: string[], cwd: string, env: Record<string, string>) {
	const child = spawn('pnpm', command, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
	children.push(child);
	// Stopping one stops everything, so a broken backend doesn't leave Studio running against it
	child.on('exit', (code) => {
		for (const other of children) {
			other.kill('SIGTERM');
		}
		process.exitCode = code ?? 1;
	});
	return child;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		for (const child of children) {
			child.kill(signal);
		}
	});
}

const convex = run(['exec', 'convex', 'dev'], cloud, { CONVEX_AGENT_MODE: 'anonymous' });

// `convex dev` writes the URL once the backend is configured, and serves it once the backend starts
let url: string | undefined;
while (convex.exitCode === null) {
	url = readEnvLocal()['VITE_CONVEX_URL'];
	if (url !== undefined && (await fetch(`${url}/version`).catch(() => undefined))?.ok) {
		break;
	}
	await sleep(500);
}
if (convex.exitCode !== null || url === undefined) {
	process.exit();
}

// Only fill in missing variables, so restarting doesn't replace the attestation key accounts were registered with
const existing = new Set(
	execFileSync('pnpm', ['exec', 'convex', 'env', 'list', '--names-only'], { cwd: cloud, encoding: 'utf8' }).split(
		/\s+/u,
	),
);
const defaults: Record<string, () => string> = {
	STUDIO_ORIGIN: () =>
		execFileSync('pnpm', ['--filter', '@doglog/studio', 'exec', 'portless', 'get', 'doglog.studio'], {
			encoding: 'utf8',
		}).trim(),
	ATTESTATION_PRIVATE_KEY: () =>
		generateKeyPairSync('ec', { namedCurve: 'P-256' })
			.privateKey.export({ type: 'pkcs8', format: 'der' })
			.toString('base64'),
	// Apple and Google sign-in can't redirect to a local backend, use a passkey instead
	AUTH_APPLE_CLIENT_ID: () => 'unused',
	AUTH_APPLE_TEAM_ID: () => 'unused',
	AUTH_APPLE_KEY_ID: () => 'unused',
	AUTH_APPLE_PRIVATE_KEY: () => 'unused',
	AUTH_GOOGLE_CLIENT_ID: () => 'unused',
	AUTH_GOOGLE_CLIENT_SECRET: () => 'unused',
};
const missing = Object.entries(defaults).filter(([name]) => !existing.has(name));
if (missing.length > 0) {
	console.log(`Setting ${missing.map(([name]) => name).join(', ')} on the local deployment`);
	const directory = mkdtempSync(path.join(tmpdir(), 'doglog-convex-'));
	const file = path.join(directory, '.env');
	try {
		writeFileSync(file, missing.map(([name, value]) => `${name}=${value()}\n`).join(''));
		// `convex dev` retries the push once they're set
		execFileSync('pnpm', ['exec', 'convex', 'env', 'set', '--from-file', file], { cwd: cloud, stdio: 'inherit' });
	} finally {
		rmSync(directory, { recursive: true });
	}
}

// Set explicitly, since the environment can already export another deployment's URL, which overrides `.env` files
run(['dev'], studio, { VITE_CONVEX_URL: url });
