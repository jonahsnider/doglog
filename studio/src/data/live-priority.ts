import { getDashboard, getDashboards, subscribeDashboards } from '@/dashboards/dashboards';
import { getEntryKind, isStudioEntry } from '@/data/samples';
import type { NtClient } from '@/nt/client';
import { panes } from '@/panes/layout';
import { settingsStore } from '@/settings';
import { tuningDashboardId } from '@/tuning/dashboard';
import { tunablesPrefixes } from '@/tuning/tunables';
import { widgetBindings } from '@/widgets/bindings';

// The timeline, controller widgets, and tuning panel read these without an explicit binding.
const builtInPrefixes = [
	'/FMSInfo/',
	'/NT:/FMSInfo/',
	'/DriverStation/',
	'/AdvantageKit/DriverStation/',
	'/NT:/AdvantageKit/DriverStation/',
	'/DS:',
	...tunablesPrefixes,
];

/** Keep the faster NT4 subscriptions in sync with dashboard bindings and topics discovered on this connection. */
export function prioritizeLiveTopics(nt: NtClient) {
	const announced = new Map<string, string>();
	const groups = new Map<string, 'Alerts' | 'Mechanism2d'>();
	let queued = false;
	let closed = false;

	const refresh = () => {
		if (queued) {
			return;
		}
		queued = true;
		queueMicrotask(() => {
			queued = false;
			if (closed) {
				return;
			}
			if (!settingsStore.get().reduceLiveBandwidth) {
				nt.setLivePriority('full');
				return;
			}
			const topics = new Set<string>();
			const prefixes = new Set(builtInPrefixes);
			for (const name of announced.keys()) {
				if (name.endsWith('/.type')) {
					topics.add(name);
				}
			}
			for (const [name, type] of groups) {
				if (type === 'Alerts') {
					topics.add(`${name}/errors`);
					topics.add(`${name}/warnings`);
				}
			}
			const tuning = getDashboard(tuningDashboardId);
			const dashboards = tuning ? [...getDashboards(), tuning] : getDashboards();
			for (const { widget } of dashboards.flatMap(({ layout }) => panes(layout))) {
				for (const { name } of widgetBindings(widget)) {
					if (!name.startsWith('/') || isStudioEntry(name)) {
						continue;
					}
					if (groups.get(name) === 'Mechanism2d' && !announced.has(name)) {
						prefixes.add(`${name}/`);
						continue;
					}
					// Generated struct fields and array elements get their samples from a real NT topic.
					let root = name;
					while (!announced.has(root) && root.lastIndexOf('/') > 0) {
						root = root.slice(0, root.lastIndexOf('/'));
					}
					const kind = getEntryKind(announced.get(root) ?? '');
					topics.add(kind === 'struct' || kind.endsWith('[]') ? root : name);
				}
			}
			nt.setLivePriority({ topics: [...topics], prefixes: [...prefixes] });
		});
	};
	const unsubscribe = subscribeDashboards(refresh);
	refresh();

	return {
		announce(name: string, type: string) {
			if (announced.get(name) !== type) {
				announced.set(name, type);
				refresh();
			}
		},
		unannounce(name: string) {
			if (announced.delete(name)) {
				if (name.endsWith('/.type')) {
					groups.delete(name.slice(0, -'/.type'.length));
				}
				refresh();
			}
		},
		value(name: string, value: unknown) {
			if (!name.endsWith('/.type')) {
				return;
			}
			const group = name.slice(0, -'/.type'.length);
			if (value === 'Alerts' || value === 'Mechanism2d') {
				if (groups.get(group) !== value) {
					groups.set(group, value);
					refresh();
				}
			} else if (groups.delete(group)) {
				refresh();
			}
		},
		close() {
			closed = true;
			unsubscribe();
		},
	};
}
