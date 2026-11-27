// What each agent command does, through the same functions the user's edits use, so they're undoable, saved, and shared
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AgentError } from '@/agent/agent-error';
import type { Handlers } from '@/agent/commands';
import { dashboardHandlers, requireDashboard, showDashboard } from '@/agent/dashboard-handlers';
import { paneHandlers } from '@/agent/pane-handlers';
import { type Entry, flushData, getTimeRange, getVisibleEntries } from '@/data/data-store';
import { saveLiveExport } from '@/data/export-live';
import { openLogPath } from '@/data/open-log';
import { openLogUrl } from '@/data/open-log-url';
import { isReachable } from '@/data/connect-target';
import {
	closeSource,
	connect,
	getSource,
	getSources,
	type LogSource,
	sourceId,
	sourceList,
	type Sources,
	subscribeSource,
	visibleSources,
} from '@/data/source';
import { sourceData } from '@/data/source-store';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { robotTargetStore, settingsStore, updateSettings } from '@/settings';
import { getTimeline, seek } from '@/timeline/timeline';

function describeSource() {
	const sources = getSources();
	const list = sourceList(sources);
	if (list.length === 0) {
		return null;
	}
	flushData();
	const visible = visibleSources(sources);
	const shown = new Set(visible);
	return {
		// oxlint-disable-next-line oxc/no-map-spread -- Each source is described with fields it doesn't have
		sources: list.map((source) => {
			const { hidden: _hidden, ...rest } = source;
			return {
				...rest,
				id: sourceId(source),
				visible: shown.has(source),
				timeBase: visible[0] === source,
				entries: sourceData(source)?.entries.size ?? 0,
			};
		}),
	};
}

/** Wait until a source is no longer loading or connecting, `undefined` if it closed first */
function waitForSource(done: (sources: Sources) => boolean): Promise<void> {
	return new Promise((resolve) => {
		const check = () => {
			if (done(getSources())) {
				unsubscribe();
				resolve();
			}
		};
		const unsubscribe = subscribeSource(check);
		check();
	});
}

/** Wait for the newest log named `fileName` to finish loading, `undefined` if it closed first */
async function waitForLog(fileName: string): Promise<LogSource | undefined> {
	const find = () => getSources().logs.findLast((log) => log.fileName === fileName);
	await waitForSource(() => find()?.status !== 'loading');
	return find();
}

/** How far the time base was moved from its own clock, agents use its own clock */
function timeBaseOffset(): number {
	const source = getSource();
	return (source && sourceData(source)?.offset) ?? 0;
}

const seconds = (microseconds: number | undefined) => (microseconds === undefined ? null : microseconds / 1_000_000);

function describeTimeline() {
	flushData();
	const range = getTimeRange();
	const { time, live } = getTimeline();
	const offset = timeBaseOffset();
	const own = (value: number | undefined) => seconds(value === undefined ? undefined : value - offset);
	return { time: own(time), start: own(range?.origin), end: own(range?.end), live };
}

function describeSettings() {
	const {
		theme,
		themePreset,
		themeColor,
		highContrast,
		reduceMotion,
		reduceTransparency,
		name,
		robotTarget,
		mediaControls,
		naturalScrolling,
	} = settingsStore.get();
	return {
		theme,
		themePreset,
		themeColor,
		highContrast,
		reduceMotion,
		reduceTransparency,
		name,
		robotTarget,
		mediaControls,
		naturalScrolling,
	};
}

export const handlers: Handlers = {
	...dashboardHandlers,
	...paneHandlers,

	window_update: async ({ dashboardId, focus }) => {
		if (dashboardId !== undefined) {
			requireDashboard(dashboardId);
			await showDashboard(dashboardId);
		}
		if (STUDIO_DESKTOP && focus === true) {
			const window = getCurrentWindow();
			await window.unminimize();
			await window.show();
			await window.setFocus();
		}
	},

	entry_list: ({ name, kind }) => {
		if (getSource() === undefined) {
			throw new AgentError('No source is open, open a log or connect to the robot with `source_update`.');
		}
		flushData();
		const search = name?.toLowerCase();
		const entries = new Map<string, Entry>();
		for (const { data } of getVisibleEntries()) {
			for (const entry of data.snapshot.list) {
				if (!entries.has(entry.name)) {
					entries.set(entry.name, entry);
				}
			}
		}
		return [...entries.values()]
			.toSorted((a, b) => (a.name < b.name ? -1 : 1))
			.filter(
				(entry) =>
					(search === undefined || entry.name.toLowerCase().includes(search)) &&
					(kind === undefined || entry.kind === kind),
			)
			.map((entry) => ({ name: entry.name, type: entry.type, kind: entry.kind, metadata: entry.metadata }));
	},

	source_get: () => describeSource(),

	source_update: async ({ path, url }) => {
		if (path !== undefined && url !== undefined) {
			throw new AgentError('Pass either `path` or `url`, not both.');
		}
		if (url !== undefined) {
			let error = '';
			const result = await openLogUrl(url, {
				onError: (message) => {
					error = message;
				},
			});
			if (!result.ok) {
				throw new AgentError(`Couldn't open ${url}: ${result.error.message}`);
			}
			const log = await waitForLog(result.fileName);
			if (log?.status !== 'loaded') {
				throw new AgentError(
					error === '' ? `${url} was closed before it finished loading.` : `Couldn't open ${url}: ${error}`,
				);
			}
			return describeSource();
		}

		if (!STUDIO_DESKTOP || path === undefined) {
			const robotHost = getRobotHost(robotTargetStore.get());
			const hosts = robotHost === undefined ? [simulatorHost] : [robotHost, simulatorHost];
			// Connecting retries until a server answers, agents are told right away instead
			if (!(await Promise.all(hosts.map((host) => isReachable(host)))).includes(true)) {
				throw new AgentError(`Couldn't reach ${hosts.join(' or ')}. Check that the robot or simulator is running.`);
			}
			await connect(robotHost);
			await waitForSource(({ live }) => live?.status !== 'connecting');
			if (getSources().live === undefined) {
				throw new AgentError('The live session was closed before the connection was made.');
			}
			return describeSource();
		}

		let error = '';
		if (
			!(await openLogPath(path, (message) => {
				error = message;
			}))
		) {
			throw new AgentError(error === '' ? `Couldn't open ${path}.` : `Couldn't open ${path}: ${error}`);
		}
		const log = await waitForLog(path.split(/[/\\]/u).at(-1)!);
		if (log?.status !== 'loaded') {
			throw new AgentError(
				error === '' ? `${path} was closed before it finished loading.` : `Couldn't open ${path}: ${error}`,
			);
		}
		return describeSource();
	},

	source_delete: ({ id }) => {
		const list = sourceList(getSources());
		const sources = id === undefined ? list : list.filter((source) => sourceId(source) === id);
		if (sources.length === 0 && id !== undefined) {
			throw new AgentError(`No source has the ID \`${id}\`, see \`source_get\`.`);
		}
		for (const source of sources) {
			closeSource(source);
		}
	},

	source_export: async ({ path }) => {
		if (!STUDIO_DESKTOP) {
			return undefined;
		}
		try {
			return { path: await saveLiveExport(path) };
		} catch (error) {
			throw new AgentError(error instanceof Error ? error.message : String(error));
		}
	},

	timeline_get: () => describeTimeline(),

	timeline_update: ({ time }) => {
		flushData();
		if (getTimeRange() === undefined) {
			throw new AgentError(
				getSource() === undefined ? 'No source is open, open one with `source_update`.' : 'The source has no data yet.',
			);
		}
		seek(time * 1_000_000 + timeBaseOffset());
		return describeTimeline();
	},

	settings_get: () => describeSettings(),

	settings_update: (changes) => {
		const { robotTarget } = changes;
		if (robotTarget !== undefined && robotTarget.trim() !== '' && getRobotHost(robotTarget) === undefined) {
			throw new AgentError('`robotTarget` must be a team number or an IP address.');
		}
		updateSettings(changes);
		return describeSettings();
	},
};
