import { expect, test } from 'vite-plus/test';
import { DataSet } from '@/data/data-set';
import { renameDevices } from '@/data/device-names';
import { searchEntries } from '@/entries/search';
import type { RobotDevices } from '@/three/robot-devices';

function log(...names: string[]): DataSet {
	const data = new DataSet(() => {});
	for (const name of names) {
		data.addSample(data.addEntry(name, 'double'), 0, names.indexOf(name));
	}
	return data;
}

/** Each entry's name, and the value it was logged with, to check renamed entries kept their samples */
function entries(data: DataSet): [string, unknown][] {
	return [...data.entries]
		.map(([name, entry]): [string, unknown] => {
			expect(entry.name).toBe(name);
			return [name, entry.samples.valueAt(0)];
		})
		.toSorted(([a], [b]) => (a < b ? -1 : 1));
}

test('renames devices with the robot that names the most of them, keeping unnamed devices and custom signals', () => {
	const data = log(
		'/Phoenix6/rio/TalonFX-16/Velocity',
		'/Phoenix6/rio/TalonFX-17/Velocity',
		'/Phoenix6/rio/CANcoder-16/Position',
		'/RobotEnable',
	);
	const robots: RobotDevices[] = [
		{ robot: 'Comp', devices: { rio: { 'TalonFX-16': 'Intake/Left', 'TalonFX-17': 'Intake/Right' } } },
		// Added later, but names fewer of the log's devices
		{ robot: 'Practice', devices: { rio: { 'TalonFX-16': 'Wrong' }, '581CANivore': { 'TalonFX-17': 'Wrong' } } },
	];
	renameDevices(data, robots);
	expect(entries(data)).toEqual([
		['/Phoenix6/rio/CANcoder-16/Position', 2],
		['/Phoenix6/rio/Intake/Left/Velocity', 0],
		['/Phoenix6/rio/Intake/Right/Velocity', 1],
		['/RobotEnable', 3],
	]);
	expect(data.entries.get('/Phoenix6/rio/Intake/Left/Velocity')?.device).toEqual({
		original: '/Phoenix6/rio/TalonFX-16/Velocity',
		id: 'TalonFX-16',
		robot: 'Comp',
	});
});

test('prefers the robot added last when robots tie', () => {
	const data = log('/Phoenix6/rio/TalonFX-16/Velocity');
	renameDevices(data, [
		{ robot: 'Old', devices: { rio: { 'TalonFX-16': 'Old' } } },
		{ robot: 'New', devices: { rio: { 'TalonFX-16': 'New' } } },
	]);
	expect(entries(data)).toEqual([['/Phoenix6/rio/New/Velocity', 0]]);
});

test('picks a robot for each embedded HOOT file', () => {
	const data = log('/RioHoot/Phoenix6/rio/TalonFX-1/Velocity', '/CanivoreHoot/Phoenix6/drive/TalonFX-1/Velocity');
	renameDevices(data, [
		{ robot: 'A', devices: { rio: { 'TalonFX-1': 'Arm' } } },
		{ robot: 'B', devices: { drive: { 'TalonFX-1': 'Drive' } } },
	]);
	expect(entries(data)).toEqual([
		['/CanivoreHoot/Phoenix6/drive/Drive/Velocity', 1],
		['/RioHoot/Phoenix6/rio/Arm/Velocity', 0],
	]);
});

test('renames devices again when their names change, including trading names', () => {
	const data = log(
		'/Phoenix6/rio/TalonFX-16/Velocity',
		'/Phoenix6/rio/TalonFX-17/Velocity',
		'/Phoenix6/rio/TalonFX-18/Velocity',
	);
	renameDevices(data, [
		{ robot: 'A', devices: { rio: { 'TalonFX-16': 'Left', 'TalonFX-17': 'Right', 'TalonFX-18': 'Top' } } },
	]);
	renameDevices(data, [{ robot: 'A', devices: { rio: { 'TalonFX-16': 'Right', 'TalonFX-17': 'Left' } } }]);
	expect(entries(data)).toEqual([
		['/Phoenix6/rio/Left/Velocity', 1],
		['/Phoenix6/rio/Right/Velocity', 0],
		['/Phoenix6/rio/TalonFX-18/Velocity', 2],
	]);
	expect(data.entries.get('/Phoenix6/rio/TalonFX-18/Velocity')?.device).toBeUndefined();

	renameDevices(data, []);
	expect(entries(data).map(([name]) => name)).toEqual([
		'/Phoenix6/rio/TalonFX-16/Velocity',
		'/Phoenix6/rio/TalonFX-17/Velocity',
		'/Phoenix6/rio/TalonFX-18/Velocity',
	]);
});

test('finds renamed devices by their model and ID', () => {
	const data = log('/Phoenix6/rio/TalonFX-16/Velocity', '/Phoenix6/rio/TalonFX-17/Velocity');
	renameDevices(data, [
		{ robot: 'A', devices: { rio: { 'TalonFX-16': 'Intake/Left', 'TalonFX-17': 'Intake/Right' } } },
	]);
	const found = searchEntries([...data.entries.values()], 'talonfx16')?.map((result) => result.obj.name);
	expect(found).toEqual(['/Phoenix6/rio/Intake/Left/Velocity']);
});
