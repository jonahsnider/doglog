import { expect, test } from 'vite-plus/test';
import { widgetBindings } from '@/widgets/bindings';
import type { Entry } from '@/data/data-store';
import { getEntryKind, Samples } from '@/data/samples';
import { defaultWidget } from '@/widgets/registry';

function entry(name: string, type: string): Entry {
	return { name, type, kind: getEntryKind(type), samples: new Samples(), metadata: {} };
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
