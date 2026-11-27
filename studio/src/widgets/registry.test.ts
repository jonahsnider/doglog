import { expect, test } from 'vite-plus/test';
import { createWidget, widgetBindings } from '@/widgets/bindings';
import { clearCameraStreams, updateCameraStreams } from '@/data/camera-streams';
import type { Entry } from '@/data/data-store';
import { createSamples, getEntryKind } from '@/data/samples';
import { sourcesStore } from '@/data/source-store';
import { createPane, splitPane } from '@/panes/layout';
import { initialOptions } from '@/widgets/options';
import { defaultWidget, getWidgetType } from '@/widgets/registry';

function entry(name: string, type: string): Entry {
	return { name, type, kind: getEntryKind(type), samples: createSamples(getEntryKind(type)), metadata: {} };
}

test.each([
	['/console', 'string', 'console'],
	['/messages', 'string', 'console'],
	['/Arm/State', 'string', 'graph'],
	['/Arm/Enabled', 'boolean', 'graph'],
	['/Arm/Angle', 'double', 'graph'],
	['/Drive/Pose', 'struct:Pose2d', 'field'],
	['/Vision/Targets', 'struct:Pose3d[]', 'field'],
	['/Drive/Speeds', 'struct:ChassisSpeeds', 'table'],
	['/Drive/MeasuredStates', 'struct:SwerveModuleState[]', 'swerve'],
	['/Drive/MeasuredStates', 'struct:SwerveModuleVelocity[]', 'swerve'],
	['/Arm/Setpoints', 'double[]', 'table'],
	['/Arm/Mechanism', 'Mechanism2d', 'robot'],
])('%s (%s) defaults to the %s', (name, type, widgetType) => {
	const widget = defaultWidget(entry(name, type));
	expect(widget?.type).toBe(widgetType);
	expect(widgetBindings(widget).map((binding) => binding.name)).toEqual([name]);
});

test('unsupported entries have no default widget', () => {
	expect(defaultWidget(entry('/Raw', 'raw'))).toBeUndefined();
});

test('new Camera widgets choose unused live feeds alphabetically, then stay unassigned', () => {
	const camera = getWidgetType('camera')!;
	const empty = createPane();
	try {
		sourcesStore.set({ logs: [], live: { type: 'live', host: 'robot.local', status: 'connected' } });
		updateCameraStreams('/CameraPublisher/Rear/streams', ['mjpg:http://robot.local:1182']);
		updateCameraStreams('/CameraPublisher/Front/streams', ['mjpg:http://robot.local:1181']);
		// An unsupported feed sorts ahead of both valid feeds but cannot be selected.
		updateCameraStreams('/CameraPublisher/Depth/streams', ['rtsp:rtsp://robot.local:5800']);
		const first = initialOptions(camera, empty);
		expect(first).toEqual({ camera: 'Front' });
		const front = { ...empty, widget: createWidget(camera, [], first) };
		const second = initialOptions(camera, front);
		expect(second).toEqual({ camera: 'Rear' });
		const rear = { ...createPane(), widget: createWidget(camera, [], second) };
		expect(initialOptions(camera, splitPane(front, front.id, 'row', rear))).toEqual({});
		expect(initialOptions(camera, createPane())).toEqual({ camera: 'Front' });

		// The camera needs the live session visible
		sourcesStore.set({
			live: { type: 'live', host: 'robot.local', status: 'connected', hidden: true },
			logs: [{ type: 'log', id: 'match', fileName: 'match.wpilog', status: 'loaded' }],
		});
		expect(initialOptions(camera, empty)).toEqual({});
	} finally {
		clearCameraStreams();
		sourcesStore.set({ logs: [] });
	}
});
