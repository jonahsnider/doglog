import { execFileSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { arch, cpus, release, type } from 'node:os';
import { basename, extname, join } from 'node:path';

export function readMacApp(app: string) {
	if (extname(app) !== '.app') throw new Error(`Expected a macOS app bundle: ${app}`);
	const {
		CFBundleIdentifier: bundleID,
		CFBundleShortVersionString: version,
		CFBundleVersion: build,
		CFBundleExecutable: executable,
	} = JSON.parse(
		execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', join(app, 'Contents/Info.plist')], {
			encoding: 'utf8',
			timeout: 45_000,
		}),
	) as Record<string, unknown>;
	if (typeof bundleID !== 'string' || typeof version !== 'string') {
		throw new Error(`Missing bundle ID or version: ${app}`);
	}
	return {
		app,
		bundleID,
		version,
		build: typeof build === 'string' ? build : undefined,
		executable: typeof executable === 'string' ? executable : undefined,
	};
}

export function measureMacAppSize(app: string, installer?: string) {
	const { executable, ...target } = readMacApp(app);
	if (!executable) throw new Error(`Missing bundle executable: ${app}`);
	const bundleArch = execFileSync('/usr/bin/lipo', ['-archs', join(app, 'Contents/MacOS', executable)], {
		encoding: 'utf8',
		timeout: 45_000,
	})
		.trim()
		.split(/\s+/u)
		.sort()
		.join(', ');
	const kilobytes = Number(
		execFileSync('/usr/bin/du', ['-sk', realpathSync(app)], {
			encoding: 'utf8',
			timeout: 45_000,
		}).split('\t', 1)[0],
	);
	if (!Number.isSafeInteger(kilobytes) || kilobytes <= 0) throw new Error(`Could not measure disk usage: ${app}`);
	let installerBytes: number | undefined;
	if (installer !== undefined) {
		if (extname(installer).toLowerCase() !== '.dmg') throw new Error(`Expected a .dmg installer: ${installer}`);
		const file = statSync(installer);
		if (!file.isFile() || file.size === 0) throw new Error(`Expected a nonempty installer file: ${installer}`);
		installerBytes = file.size;
	}
	return {
		benchmark: 'size:macos',
		run: 1,
		timestamp: new Date().toISOString(),
		os: `${type()} ${release()}`,
		arch: arch(),
		cpu: cpus()[0]?.model,
		...target,
		bundleArch,
		installedBytes: kilobytes * 1024,
		installer: installer === undefined ? undefined : basename(installer),
		installerBytes,
	};
}
