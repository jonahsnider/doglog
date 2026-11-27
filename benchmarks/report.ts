import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

type Benchmark = 'startup:macos' | 'startup:chrome' | 'size:macos' | 'wpilog:chrome';
type MetricKey =
	| 'firstWindowMs'
	| 'readyMs'
	| 'mainFrameLcpMs'
	| 'mainFrameCls'
	| 'installedBytes'
	| 'installerBytes'
	| 'openGraphMs';
type Metric = { key: MetricKey; label: string; unit?: 'ms' | 'bytes'; compare?: true };
type Sample = Partial<Record<MetricKey, number | null>> & {
	benchmark: Benchmark;
	app: string;
	version: string;
	run: number;
	os: string;
	arch: string;
	cpu?: string;
	browserVersion?: string;
	bundleID?: string;
	bundleArch?: string;
	build?: string;
	installer?: string;
	url?: string;
	logName?: string;
	logBytes?: number;
	logSha256?: string;
	signal?: string;
	error?: string;
};

const benchmarks: Record<Benchmark, { title: string; baseline: string; metrics: Metric[] }> = {
	'startup:macos': {
		title: 'macOS startup',
		baseline: 'AdvantageScope',
		metrics: [{ key: 'firstWindowMs', label: 'Launch to first visible window', unit: 'ms', compare: true }],
	},
	'startup:chrome': {
		title: 'Chrome startup',
		baseline: 'AdvantageScope Lite',
		metrics: [
			{ key: 'readyMs', label: 'Navigation to app ready', unit: 'ms', compare: true },
			{ key: 'mainFrameLcpMs', label: 'Top-level LCP', unit: 'ms' },
			{ key: 'mainFrameCls', label: 'Top-level CLS' },
		],
	},
	'wpilog:chrome': {
		title: 'Chrome WPILOG',
		baseline: 'AdvantageScope Lite',
		metrics: [{ key: 'openGraphMs', label: 'Open log to first data line drawn', unit: 'ms', compare: true }],
	},
	'size:macos': {
		title: 'macOS size',
		baseline: 'AdvantageScope',
		metrics: [
			{ key: 'installedBytes', label: 'Installed app (disk usage)', unit: 'bytes', compare: true },
			{ key: 'installerBytes', label: 'Installer download (.dmg)', unit: 'bytes', compare: true },
		],
	},
};

function readSample(line: string): Sample {
	const sample = JSON.parse(line) as Sample | null;
	if (
		!sample ||
		!Object.hasOwn(benchmarks, sample.benchmark) ||
		typeof sample.app !== 'string' ||
		typeof sample.version !== 'string' ||
		typeof sample.os !== 'string' ||
		typeof sample.arch !== 'string' ||
		(sample.error !== undefined && typeof sample.error !== 'string') ||
		!Number.isSafeInteger(sample.run)
	) {
		throw new Error('Invalid benchmark sample.');
	}
	if (
		sample.benchmark === 'wpilog:chrome' &&
		(!sample.logName || !sample.logBytes || !sample.logSha256 || !sample.signal)
	) {
		throw new Error('WPILOG samples require the log name, size, SHA-256, and signal.');
	}
	return sample;
}

function describe(samples: Sample[], metric: Metric) {
	const values = samples
		.filter((sample) => sample.error === undefined)
		.map((sample) => sample[metric.key])
		.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
		.sort((a, b) => a - b);
	const n = values.length;
	if (n === 0) return { label: samples.length ? 'No measurement' : 'Not run', median: undefined };
	const median = (values[Math.floor((n - 1) / 2)]! + values[Math.floor(n / 2)]!) / 2;
	if (metric.unit === 'bytes') return { label: `${(median / 2 ** 20).toFixed(1)} MiB`, median };
	const format = (value: number) => (metric.unit === 'ms' ? `${value.toFixed(1)} ms` : value.toFixed(5));
	const range = n > 1 ? `${format(values[0]!)}–${format(values[n - 1]!)}; ` : '';
	return { label: `${format(median)} (${range}n=${n})`, median };
}

function compare(
	studio: number | undefined,
	baseline: number | undefined,
	metric: Metric,
	mixedArchitectures: boolean,
) {
	if (!metric.compare) return 'Not comparable';
	if (studio === undefined || baseline === undefined || baseline === 0) return '—';
	if (mixedArchitectures) return 'Different architectures';
	if (studio === baseline) return metric.unit === 'bytes' ? 'Same size' : 'Same median';
	const percent = (Math.abs(studio - baseline) / baseline) * 100;
	const difference =
		metric.unit === 'bytes'
			? studio < baseline
				? 'smaller'
				: 'larger'
			: studio < baseline
				? 'less time'
				: 'more time';
	return `${percent < 0.1 ? '<0.1' : percent.toFixed(1)}% ${difference}`;
}

function appSide(sample: Sample) {
	if (sample.benchmark === 'startup:chrome' || sample.benchmark === 'wpilog:chrome') {
		if (sample.app === 'studio' || sample.app === 'lite') return sample.app === 'studio' ? 'studio' : 'baseline';
	} else {
		if (sample.bundleID === 'studio.doglog') return 'studio';
		if (sample.bundleID === 'org.littletonrobotics.advantagescope') return 'baseline';
	}
	throw new Error(`Unrecognized benchmark target: ${sample.app}`);
}

function environment({ benchmark, os, arch, cpu, browserVersion, logBytes, logSha256, signal }: Sample) {
	return JSON.stringify([benchmark, os, arch, cpu, browserVersion, logBytes, logSha256, signal]);
}

function target({ app, version, build, url, bundleArch, installer }: Sample) {
	return JSON.stringify([app, version, build, url, bundleArch, installer]);
}

function versionLabel(name: string, sample: Sample | undefined) {
	if (!sample) return `${name} (not run)`;
	const build = sample.build && sample.build !== sample.version ? ` (build ${sample.build})` : '';
	const architecture = sample.bundleArch ? ` (${sample.bundleArch})` : '';
	return `${name} ${sample.version}${build}${architecture}`;
}

async function reportSection(file: string) {
	const samples = (await readFile(file, 'utf8')).split('\n').flatMap((line, i) => {
		if (!line.trim()) return [];
		try {
			return [readSample(line)];
		} catch (error) {
			throw new Error(`${file}:${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
		}
	});
	const first = samples[0];
	if (!first) throw new Error(`${file}: no samples`);
	const { title, baseline: baselineName, metrics } = benchmarks[first.benchmark];
	const setup = environment(first);
	const byApp: Record<ReturnType<typeof appSide>, Sample[]> = { studio: [], baseline: [] };
	for (const sample of samples) {
		const app = byApp[appSide(sample)];
		if (environment(sample) !== setup || (app[0] && target(app[0]) !== target(sample))) {
			throw new Error(`${file}: mixed benchmark, environment, workload, or app builds. Pass one comparison per file.`);
		}
		app.push(sample);
	}

	const machine = [first.cpu, first.os, first.arch, first.browserVersion && `Chrome ${first.browserVersion}`]
		.filter(Boolean)
		.join(' · ');
	const section = [
		`## ${title} (${basename(file)})`,
		'',
		machine,
		'',
		`${versionLabel('Studio', byApp.studio[0])} · ${versionLabel(baselineName, byApp.baseline[0])}`,
		'',
		`| Benchmark | Studio | ${baselineName} | Studio vs. baseline |`,
		'| --- | --- | --- | --- |',
	];
	const mixedArchitectures =
		first.benchmark === 'size:macos' && byApp.studio[0]?.bundleArch !== byApp.baseline[0]?.bundleArch;
	for (const metric of metrics) {
		const studio = describe(byApp.studio, metric);
		const baseline = describe(byApp.baseline, metric);
		section.push(
			`| ${metric.label} | ${studio.label} | ${baseline.label} | ${compare(studio.median, baseline.median, metric, mixedArchitectures)} |`,
		);
	}
	if (first.benchmark === 'startup:chrome') {
		section.push(
			'',
			'Top-level LCP and CLS exclude the Lite workspace iframe; compare navigation to app ready instead.',
		);
	}
	if (first.benchmark === 'wpilog:chrome') {
		section.push(
			'',
			`Log: \`${first.logName}\` (${(first.logBytes! / 2 ** 20).toFixed(1)} MiB). Signal: \`${first.signal}\`.`,
			'',
			'Both apps open the same log over loopback HTTP with one graph already configured. Timing ends at the first data line drawn to the canvas, not full import or a compositor paint.',
		);
	}
	if (first.benchmark === 'size:macos') {
		const studioDmg = byApp.studio[0]?.installer;
		const scopeDmg = byApp.baseline[0]?.installer;
		section.push(
			'',
			'Installed size is the disk space allocated to the app bundle on this machine. Installer size is the file length.',
			studioDmg && scopeDmg ? `Installers: ${studioDmg} and ${scopeDmg}.` : 'No installer files supplied.',
		);
	}
	const failed = samples.filter((sample) => sample.error !== undefined);
	if (failed.length) {
		section.push('', `**Failed samples (${failed.length})**`);
		for (const sample of failed) {
			const name = appSide(sample) === 'studio' ? 'Studio' : baselineName;
			section.push(`- ${name}, run ${sample.run}: ${sample.error?.split('\n', 1)[0]}`);
		}
	}
	return section.join('\n');
}

const usage = 'Usage: pnpm --silent --filter @doglog/benchmarks report <results.jsonl> [<results.jsonl> ...]';
const files = process.argv.slice(2);
try {
	if (files[0] === '--help') {
		console.log(usage);
	} else {
		if (!files.length) throw new Error(usage);
		const cwd = process.env['INIT_CWD'] ?? process.cwd();
		const sections = await Promise.all(files.map((file) => reportSection(resolve(cwd, file))));
		console.log(
			[
				'# Benchmark comparison',
				'Timing and browser vitals show medians, min–max ranges, and sample counts (`n`). Lower is better.',
				...sections,
			].join('\n\n'),
		);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
