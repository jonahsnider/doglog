import { expect, test } from 'vite-plus/test';
import { createDashboard, deleteDashboard, updateDashboard } from '@/dashboards/dashboards';
import { DataSet } from '@/data/data-set';
import { connectLive } from '@/data/live-source';
import type { RecordingEvent } from '@/data/recorder';
import type { NtClient, NtListener, NtLivePriority, NtSubscribeOptions } from '@/nt/client';
import { createPane } from '@/panes/layout';
import { settingsStore, updateSettings } from '@/settings';
import { createWidget, setBoundEntries } from '@/widgets/bindings';
import { getWidgetType } from '@/widgets/registry';

test('a live session prioritizes the topics behind dashboard fields but still records background data', async ({
	onTestFinished,
}) => {
	const data = new DataSet(() => {});
	const events: RecordingEvent[] = [];
	const subscriptions = new Map<string, { options: NtSubscribeOptions; listener: NtListener }>();
	let priority: NtLivePriority | undefined;
	const nt: NtClient = {
		isConnected: () => true,
		serverTime: () => 1,
		onConnectedChange(listener) {
			queueMicrotask(() => listener(true));
			return () => {};
		},
		subscribe(prefix, options, listener) {
			subscriptions.set(prefix, { options, listener });
			return () => {
				subscriptions.delete(prefix);
			};
		},
		setLivePriority(value) {
			priority = value;
		},
		publish: () => Promise.resolve(),
		setValue: () => {},
		unpublish: () => {},
		close: () => {},
	};
	const before = settingsStore.get().reduceLiveBandwidth;
	updateSettings({ reduceLiveBandwidth: true });
	const widget = createWidget(getWidgetType('graph')!, ['/Drive/Modules/0/speed', '/Drive/Heading']);
	const pane = { ...createPane(), widget };
	const dashboard = createDashboard('top', { layout: pane });
	const disconnect = connectLive(
		nt,
		data,
		{
			record(event) {
				events.push(event);
			},
		},
		() => {},
	);
	onTestFinished(() => {
		disconnect();
		deleteDashboard(dashboard.id);
		updateSettings({ reduceLiveBandwidth: before });
	});

	const { options, listener } = subscriptions.get('/')!;
	expect(options).toMatchObject({ periodic: 2 });
	expect(options.all).not.toBe(true);
	await Promise.resolve();
	listener.announce?.({ name: '/Drive/Modules', type: 'struct:SwerveModuleState[]', properties: {} });
	listener.announce?.({ name: '/Drive/HeadingRaw', type: 'double', properties: {} });
	listener.value?.('/Drive/HeadingRaw', 'double', 31, 1);
	await Promise.resolve();
	expect(priority).toMatchObject({ topics: ['/Drive/Modules', '/Drive/Heading'] });
	expect(data.entries.get('/Drive/HeadingRaw')?.samples.values).toEqual([31]);
	expect(events).toContainEqual({
		type: 'value',
		name: '/Drive/HeadingRaw',
		topicType: 'double',
		value: 31,
		serverTime: 1,
	});

	updateDashboard(dashboard.id, (current) => ({
		...current,
		layout: setBoundEntries(current.layout, pane.id, ['/Drive/HeadingRaw']),
	}));
	await Promise.resolve();
	expect(priority).toMatchObject({ topics: ['/Drive/HeadingRaw'] });

	updateSettings({ reduceLiveBandwidth: false });
	await Promise.resolve();
	expect(priority).toBe('full');
	expect(data.entries.get('/Drive/HeadingRaw')?.samples.values).toEqual([31]);
});
