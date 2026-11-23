import { afterEach, expect, test } from 'vite-plus/test';
import { DataSet } from '@/data/data-set';
import { setActiveData } from '@/data/data-store';
import type { Value } from '@/data/samples';
import { getModePeriods } from './events.ts';

afterEach(() => {
	setActiveData(undefined);
});

type ModeSamples = readonly (readonly [number, Value])[];

function addSamples(data: DataSet, name: string, samples: ModeSamples) {
	const type = typeof samples[0]![1];
	const entry = data.addEntry(name, type === 'number' ? 'int64' : type);
	for (const [time, value] of samples) {
		data.addSample(entry, time, value);
	}
}

const enabled = [
	[10, false],
	[30, true],
	[85, false],
] as const;
const autonomous = [
	[20, true],
	[45, false],
] as const;
const utility = [
	[10, false],
	[70, true],
] as const;
const estop = [
	[10, false],
	[85, true],
] as const;
const robotMode = [
	[20, 'AUTONOMOUS'],
	[45, 'TELEOPERATED'],
	[70, 'UTILITY'],
] as const;
const oldFlags = { Enabled: enabled, Autonomous: autonomous, Test: utility, EmergencyStop: estop };
const newFlags = { Enabled: enabled, RobotMode: robotMode, EmergencyStop: estop };

test.each<{ prefix: string; fields: Record<string, ModeSamples> }>([
	{ prefix: '/DS:', fields: { enabled, autonomous, test: utility, estop } },
	{ prefix: '/DriverStation/', fields: oldFlags },
	{ prefix: '/AdvantageKit/DriverStation/', fields: newFlags },
	{ prefix: '/NT:/AdvantageKit/DriverStation/', fields: newFlags },
])('robot mode periods from $prefix', ({ prefix, fields }) => {
	const data = new DataSet(() => {});
	for (const [name, samples] of Object.entries(fields)) {
		addSamples(data, `${prefix}${name}`, samples);
	}
	addSamples(data, '/FMSInfo/FMSControlData', [[0, 1]]);
	setActiveData(data);

	expect(getModePeriods({ start: 0, end: 100 })).toEqual([
		{ mode: 'disabled', start: 10, end: 30 },
		{ mode: 'auto', start: 30, end: 45 },
		{ mode: 'teleop', start: 45, end: 70 },
		{ mode: 'test', start: 70, end: 85 },
		{ mode: 'estop', start: 85, end: 100 },
	]);
});
