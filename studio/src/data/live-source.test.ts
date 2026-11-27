import { expect, test, vi } from 'vite-plus/test';
import { DataLogWriter, isDataRecord, parseDataLog } from 'wpilog-parser';
import { createDashboard, deleteDashboard, updateDashboard } from '@/dashboards/dashboards';
import { DataSet } from '@/data/data-set';
import { connectLive } from '@/data/live-source';
import { parseLog } from '@/data/parse-log';
import { Recorder, type RecordingEvent } from '@/data/recorder';
import { closeLive, disconnect as disconnectSource, getSources } from '@/data/source';
import { adoptLive } from '@/data/source-transfer';
import type { NtClient, NtListener, NtLivePriority, NtSubscribeOptions } from '@/nt/client';
import { createPane } from '@/panes/layout';
import { settingsStore, updateSettings } from '@/settings';
import { createWidget, setBoundEntries } from '@/widgets/bindings';
import { getWidgetType } from '@/widgets/registry';

test.for([
	{ session: 'never connected', status: 'connecting', start: undefined, remainingStatus: undefined },
	{ session: 'connected without receiving samples', status: 'connected', start: 0, remainingStatus: 'disconnected' },
] as const)(
	'disconnecting a moved live session that $session',
	({ status, start, remainingStatus }, { onTestFinished }) => {
		// oxlint-disable-next-line landmines/no-test-doubles -- Publishing source data needs a browser frame in Node tests
		vi.stubGlobal('requestAnimationFrame', queueMicrotask);
		onTestFinished(() => {
			closeLive();
			vi.unstubAllGlobals();
		});
		const data = new DataSet(() => {}).toTransfer();
		expect(
			adoptLive({
				live: { type: 'live', host: 'localhost', status },
				data: { ...data, start },
			}),
		).toBe(true);
		expect(getSources().live?.status).toBe('reconnecting');

		disconnectSource();

		expect(getSources().live?.status).toBe(remainingStatus);
	},
);

/** An NT client that's connected once a microtask passes, with the subscriptions live sessions make and the priority they set */
function fakeNt() {
	const subscriptions = new Map<string, { options: NtSubscribeOptions; listener: NtListener }>();
	const state: { priority: NtLivePriority | undefined } = { priority: undefined };
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
			state.priority = value;
		},
		publish: () => Promise.resolve(),
		setValue: () => {},
		unpublish: () => {},
		close: () => {},
	};
	return { nt, subscriptions, state };
}

test('a live session prioritizes the topics behind dashboard fields but still records background data', async ({
	onTestFinished,
}) => {
	const data = new DataSet(() => {});
	const events: RecordingEvent[] = [];
	const { nt, subscriptions, state } = fakeNt();
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
	expect(state.priority).toMatchObject({ topics: ['/Drive/Modules', '/Drive/Heading'] });
	expect(data.entries.get('/Drive/HeadingRaw')?.samples.values()).toEqual([31]);
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
	expect(state.priority).toMatchObject({ topics: ['/Drive/HeadingRaw'] });

	updateSettings({ reduceLiveBandwidth: false });
	await Promise.resolve();
	expect(state.priority).toBe('full');
	expect(data.entries.get('/Drive/HeadingRaw')?.samples.values()).toEqual([31]);
});

// WPILib's geometry2d.proto, encoded by protoc, as robots publish it to `/.schema/proto:geometry2d.proto`
const geometry2d = Uint8Array.from(
	atob(
		'ChBnZW9tZXRyeTJkLnByb3RvEgl3cGkucHJvdG8iMwoVUHJvdG9idWZUcmFuc2xhdGlvbjJkEgwKAXgYASABKAFSAXgSDAoBeRgCIAEoAVIBeSIqChJQcm90b2J1ZlJvdGF0aW9uMmQSFAoFdmFsdWUYASABKAFSBXZhbHVlIo8BCg5Qcm90b2J1ZlBvc2UyZBJCCgt0cmFuc2xhdGlvbhgBIAEoCzIgLndwaS5wcm90by5Qcm90b2J1ZlRyYW5zbGF0aW9uMmRSC3RyYW5zbGF0aW9uEjkKCHJvdGF0aW9uGAIgASgLMh0ud3BpLnByb3RvLlByb3RvYnVmUm90YXRpb24yZFIIcm90YXRpb24ilAEKE1Byb3RvYnVmVHJhbnNmb3JtMmQSQgoLdHJhbnNsYXRpb24YASABKAsyIC53cGkucHJvdG8uUHJvdG9idWZUcmFuc2xhdGlvbjJkUgt0cmFuc2xhdGlvbhI5Cghyb3RhdGlvbhgCIAEoCzIdLndwaS5wcm90by5Qcm90b2J1ZlJvdGF0aW9uMmRSCHJvdGF0aW9uIkkKD1Byb3RvYnVmVHdpc3QyZBIOCgJkeBgBIAEoAVICZHgSDgoCZHkYAiABKAFSAmR5EhYKBmR0aGV0YRgDIAEoAVIGZHRoZXRhIngKE1Byb3RvYnVmUmVjdGFuZ2xlMmQSMQoGY2VudGVyGAEgASgLMhkud3BpLnByb3RvLlByb3RvYnVmUG9zZTJkUgZjZW50ZXISFgoGeFdpZHRoGAIgASgBUgZ4V2lkdGgSFgoGeVdpZHRoGAMgASgBUgZ5V2lkdGgiggEKEVByb3RvYnVmRWxsaXBzZTJkEjEKBmNlbnRlchgBIAEoCzIZLndwaS5wcm90by5Qcm90b2J1ZlBvc2UyZFIGY2VudGVyEhwKCXhTZW1pQXhpcxgCIAEoAVIJeFNlbWlBeGlzEhwKCXlTZW1pQXhpcxgDIAEoAVIJeVNlbWlBeGlzQhoKGGVkdS53cGkuZmlyc3QubWF0aC5wcm90b2IGcHJvdG8z',
	),
	(char) => char.codePointAt(0) ?? 0,
);
// A `wpi.proto.ProtobufPose2d` of `translation { x: 1.5 y: -2 } rotation { value: 3 }`
const pose = Uint8Array.from('0a1209000000000000f83f1100000000000000c01209090000000000000840'.match(/../gu)!, (byte) =>
	Number.parseInt(byte, 16),
);

/** Data records of an entry in a log */
function recordsOf(bytes: Uint8Array, name: string) {
	return [...parseDataLog(bytes)].filter((record) => isDataRecord(record) && record.entry.name === name);
}

test('a live session decodes protobuf values that arrived before their schema, and records the schema once', async () => {
	const data = new DataSet(() => {});
	const writer = new DataLogWriter();
	const { nt, subscriptions } = fakeNt();
	const disconnect = connectLive(nt, data, new Recorder(writer, 'localhost'), () => {});
	await Promise.resolve();

	const { listener } = subscriptions.get('/')!;
	listener.announce?.({ name: '/Pose', type: 'proto:wpi.proto.ProtobufPose2d', properties: {} });
	listener.value?.('/Pose', 'proto:wpi.proto.ProtobufPose2d', pose, 5);
	expect(data.entries.get('/Pose')?.samples.length).toBe(0);

	// The server sends the schema to both subscriptions
	const schemaName = '/.schema/proto:geometry2d.proto';
	listener.value?.(schemaName, 'proto:FileDescriptorProto', geometry2d, 2);
	subscriptions.get('/.schema/proto:')!.listener.value?.(schemaName, 'proto:FileDescriptorProto', geometry2d, 2);

	const decoded = { translation: { x: 1.5, y: -2 }, rotation: { value: 3 } };
	const { samples } = data.entries.get('/Pose')!;
	expect(samples.values()).toEqual([decoded]);
	// When it arrived, 4 µs after connecting on the server's clock
	expect(samples.timestamps[0]! - data.start!).toBe(4);
	data.publish();
	expect(data.entries.get('/Pose/translation/y')?.samples.values()).toEqual([-2]);

	disconnect();
	writer.close();
	const bytes = new Uint8Array(await new Response(writer.readable).arrayBuffer());
	expect(
		parseLog(bytes, () => {})
			.entries.get('/Pose')
			?.samples.values(),
	).toEqual([decoded]);
	expect(recordsOf(bytes, schemaName)).toHaveLength(1);
});
