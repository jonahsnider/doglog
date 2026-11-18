// What each agent command does, through the same functions the user's edits use, so they're undoable, saved, and shared
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AgentError } from '@/agent/agent-error';
import type { Handlers } from '@/agent/commands';
import { dashboardHandlers, requireDashboard, showDashboard } from '@/agent/dashboard-handlers';
import { paneHandlers } from '@/agent/pane-handlers';
import { flushData, getEntries, getTimeRange } from '@/data/data-store';
import { openLogPath } from '@/data/open-log';
import { closeSource, connect, getSource, isReachable, type Source, subscribeSource } from '@/data/source';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { settingsStore, updateSettings } from '@/settings';
import { getTimeline, seek } from '@/timeline/timeline';

function describeSource() {
	const source = getSource();
	if (!source) {
		return null;
	}
	flushData();
	return { ...source, entries: getEntries().length };
}

/** Resolves with the active source once `done` is true for it */
function waitForSource(done: (source: Source | undefined) => boolean): Promise<Source | undefined> {
	return new Promise((resolve) => {
		const check = () => {
			const source = getSource();
			if (done(source)) {
				unsubscribe();
				resolve(source);
			}
		};
		const unsubscribe = subscribeSource(check);
		check();
	});
}

const seconds = (microseconds: number | undefined) => (microseconds === undefined ? null : microseconds / 1_000_000);

function describeTimeline() {
	flushData();
	const range = getTimeRange();
	const { time, live } = getTimeline();
	return { time: seconds(time), start: seconds(range?.start), end: seconds(range?.end), live };
}

function describeSettings() {
	const { theme, themePreset, themeColor, contrast, name, robotTarget, mediaControls, naturalScrolling } =
		settingsStore.get();
	return { theme, themePreset, themeColor, contrast, name, robotTarget, mediaControls, naturalScrolling };
}

export const handlers: Handlers = {
	...dashboardHandlers,
	...paneHandlers,

	window_update: async ({ dashboardId, focus }) => {
		if (dashboardId !== undefined) {
			requireDashboard(dashboardId);
			await showDashboard(dashboardId);
		}
		if (focus === true) {
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
		return getEntries()
			.filter(
				(entry) =>
					(search === undefined || entry.name.toLowerCase().includes(search)) &&
					(kind === undefined || entry.kind === kind),
			)
			.map((entry) => ({ name: entry.name, type: entry.type, kind: entry.kind, metadata: entry.metadata }));
	},

	source_get: () => describeSource(),

	source_update: async ({ path }) => {
		if (path === undefined) {
			const robotHost = getRobotHost(settingsStore.get().robotTarget);
			const hosts = robotHost === undefined ? [simulatorHost] : [robotHost, simulatorHost];
			// Connecting retries until a server answers, agents are told right away instead
			if (!(await Promise.all(hosts.map((host) => isReachable(host)))).includes(true)) {
				throw new AgentError(`Couldn’t reach ${hosts.join(' or ')}. Check that the robot or simulator is running.`);
			}
			await connect(robotHost);
			const source = await waitForSource((other) => other?.type !== 'live' || other.status !== 'connecting');
			if (source?.type !== 'live') {
				throw new AgentError('Another source was opened before the connection was made.');
			}
			return describeSource();
		}

		let error = '';
		if (
			!(await openLogPath(path, (message) => {
				error = message;
			}))
		) {
			throw new AgentError(
				error === '' ? `Another source was opened before ${path} could be.` : `Couldn’t open ${path}: ${error}`,
			);
		}
		const loading = getSource();
		const source = await waitForSource((other) => other !== loading);
		if (source?.type !== 'log' || source.status !== 'loaded') {
			throw new AgentError(
				source === undefined
					? `Couldn’t open ${path}: ${error}`
					: `Another source was opened before ${path} finished loading.`,
			);
		}
		return describeSource();
	},

	source_delete: () => {
		closeSource();
	},

	timeline_get: () => describeTimeline(),

	timeline_update: ({ time }) => {
		flushData();
		if (getTimeRange() === undefined) {
			throw new AgentError(
				getSource() === undefined ? 'No source is open, open one with `source_update`.' : 'The source has no data yet.',
			);
		}
		seek(time * 1_000_000);
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
