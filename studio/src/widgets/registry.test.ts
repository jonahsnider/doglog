import { expect, test } from 'vite-plus/test';
import type { Entry } from '@/data/data-store';
import { getEntryKind, Samples } from '@/data/samples';
import { defaultWidget } from '@/widgets/registry';

function entry(name: string, type: string): Entry {
	return { name, type, kind: getEntryKind(type), samples: new Samples() };
}

test.each([
	['/console', 'string', 'console'],
	['/messages', 'string', 'console'],
	['/Arm/State', 'string', 'discrete-timeline'],
	['/Arm/Enabled', 'boolean', 'discrete-timeline'],
	['/Drive/Pose', 'struct:Pose2d', 'values-table'],
	['/Arm/Setpoints', 'double[]', 'values-table'],
])('%s (%s) defaults to the %s', (name, type, widgetType) => {
	expect(defaultWidget(entry(name, type))).toEqual({ type: widgetType, config: { entries: [name] } });
});

test('unsupported entries have no default widget', () => {
	expect(defaultWidget(entry('/Raw', 'raw'))).toBeUndefined();
});
