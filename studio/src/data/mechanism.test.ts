import { expect, test } from 'vite-plus/test';
import type { Entry } from '@/data/data-store';
import { mechanismLayout, readMechanism } from '@/data/mechanism';
import { createSamples, getEntryKind, type Value } from '@/data/samples';

function entry(name: string, type: string, value: Value, time = 0): Entry {
	const samples = createSamples(getEntryKind(type));
	samples.push(time, value);
	return { name, type, kind: getEntryKind(type), samples, metadata: {} };
}

/** An arm on a root, with a wrist on the arm, as WPILib 2027 logs it */
const arm2027 = [
	entry('/Mech/.type', 'string', 'Mechanism2d'),
	entry('/Mech/dims', 'double[]', [3, 2]),
	entry('/Mech/backgroundColor', 'string', '#000000'),
	entry('/Mech/Base/position', 'double[]', [1, 0.5]),
	entry('/Mech/Base/Arm/.type', 'string', 'line'),
	entry('/Mech/Base/Arm/angle', 'double', 90),
	entry('/Mech/Base/Arm/length', 'double', 1),
	entry('/Mech/Base/Arm/color', 'string', '#ff0000'),
	entry('/Mech/Base/Arm/weight', 'double', 4),
	entry('/Mech/Base/Arm/Wrist/angle', 'double', -90),
	entry('/Mech/Base/Arm/Wrist/length', 'double', 0.5),
];

test('reads ligaments relative to their parents', () => {
	const mechanism = readMechanism(mechanismLayout('/Mech', arm2027), 0);
	expect(mechanism?.width).toBe(3);
	expect(mechanism?.height).toBe(2);
	expect(mechanism?.backgroundColor).toBe('#000000');
	expect(mechanism?.lines).toEqual([
		{
			id: '/Mech/Base/Arm',
			start: { x: 1, y: 0.5 },
			end: { x: 1, y: 1.5 },
			color: '#ff0000',
			weight: 4,
		},
		// WPILib's defaults for the color and weight it wasn't logged with
		{
			id: '/Mech/Base/Arm/Wrist',
			start: { x: 1, y: 1.5 },
			end: { x: 1.5, y: 1.5 },
			color: '#eb8934',
			weight: 10,
		},
	]);
});

test('reads WPILib 2026 roots', () => {
	const entries = [
		entry('/Mech/dims', 'double[]', [3, 2]),
		entry('/Mech/Base/x', 'double', 2),
		entry('/Mech/Base/y', 'double', 1),
		entry('/Mech/Base/Arm/angle', 'double', 0),
		entry('/Mech/Base/Arm/length', 'double', 1),
	];
	const line = readMechanism(mechanismLayout('/Mech', entries), 0)?.lines[0];
	expect(line?.start).toEqual({ x: 2, y: 1 });
	expect(line?.end).toEqual({ x: 3, y: 1 });
});

test('has no value before its size is logged', () => {
	const entries = [entry('/Mech/dims', 'double[]', [3, 2], 10)];
	expect(readMechanism(mechanismLayout('/Mech', entries), 5)).toBeUndefined();
	expect(readMechanism(mechanismLayout('/Mech', entries), 10)).toBeDefined();
});

test("ignores entries of other mechanisms that share the name's start", () => {
	const entries = [...arm2027, entry('/Mechanism/Base/Arm/angle', 'double', 0)];
	expect(readMechanism(mechanismLayout('/Mech', entries), 0)?.lines).toHaveLength(2);
});
