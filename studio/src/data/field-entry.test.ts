import { parseStructSpecification } from 'wpilog-parser';
import { describe, expect, test } from 'vite-plus/test';
import { DataSet } from '@/data/data-set';
import { Samples, type Value } from '@/data/samples';

function samplesOf(...items: [number, Value][]): Samples {
	const samples = new Samples();
	for (const [timestamp, value] of items) {
		samples.push(timestamp, value);
	}
	return samples;
}

function valuesOf(samples: Samples): [number, Value][] {
	return samples.values.map((value, index) => [samples.timestamps[index]!, value]);
}

describe('field entries', () => {
	test('struct array fields are entries of their own, nested as deep as they go', () => {
		const data = new DataSet(() => {});
		data.addEntry(
			'/Drive/ModuleStates',
			'struct:SwerveModuleState[]',
			samplesOf(
				[
					10,
					[
						{ speed: 1, angle: { value: 0.5 } },
						{ speed: 2, angle: { value: 0.25 } },
					],
				],
				[
					20,
					[
						{ speed: 3, angle: { value: 0.5 } },
						{ speed: 4, angle: { value: 1 } },
					],
				],
			),
		);
		data.addStructSchema('SwerveModuleState', parseStructSpecification('double speed;Rotation2d angle'));
		data.addStructSchema('Rotation2d', parseStructSpecification('double value'));
		data.publish();

		const speed = data.entries.get('/Drive/ModuleStates/1/speed');
		expect(speed).toMatchObject({ type: 'double', kind: 'number' });
		expect(valuesOf(speed!.samples)).toEqual([
			[10, 2],
			[20, 4],
		]);
		expect(data.entries.get('/Drive/ModuleStates/0/angle')?.type).toBe('struct:Rotation2d');
		expect(valuesOf(data.entries.get('/Drive/ModuleStates/1/angle/value')!.samples)).toEqual([
			[10, 0.25],
			[20, 1],
		]);
		expect(data.snapshot.list.map((entry) => entry.name)).toContain('/Drive/ModuleStates/1/angle/value');
	});

	test('array elements follow live data, including elements first logged later and trimmed history', () => {
		const data = new DataSet(() => {});
		const speeds = data.addEntry('/Drive/Speeds', 'double[]', undefined, { unit: 'm/s' });
		data.addSample(speeds, 10, [1]);
		data.publish();
		const first = data.entries.get('/Drive/Speeds/0')!;
		expect(first.metadata).toEqual({ unit: 'm/s' });
		expect(valuesOf(first.samples)).toEqual([[10, 1]]);
		expect(data.entries.has('/Drive/Speeds/1')).toBe(false);

		data.addSample(speeds, 20, [2, 5]);
		data.addSample(speeds, 30, [3]);
		data.publish();
		expect(valuesOf(first.samples)).toEqual([
			[10, 1],
			[20, 2],
			[30, 3],
		]);
		// Only has a value when the array was long enough
		expect(valuesOf(data.entries.get('/Drive/Speeds/1')!.samples)).toEqual([[20, 5]]);

		speeds.samples.trimBefore(25);
		expect(valuesOf(first.samples)).toEqual([
			[20, 2],
			[30, 3],
		]);
	});

	test('replaying live history keeps its samples and extent as live data grows and is trimmed', () => {
		const live = new DataSet(() => {});
		const speeds = live.addEntry('/Drive/Speeds', 'double[]');
		live.addSample(speeds, 10, [1, 4]);
		live.addSample(speeds, 30, [2, 8]);
		live.publish();
		const replay = live.copyForReplay();
		replay.publish();

		live.addSample(speeds, 50, [3, 9]);
		speeds.samples.trimBefore(31);
		live.publish();

		expect(replay.timeRange).toEqual({ start: 10, end: 30 });
		expect(valuesOf(replay.entries.get('/Drive/Speeds/1')!.samples)).toEqual([
			[10, 4],
			[30, 8],
		]);
		expect(valuesOf(live.entries.get('/Drive/Speeds/1')!.samples)).toEqual([
			[30, 8],
			[50, 9],
		]);
	});
});
