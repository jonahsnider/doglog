import { expect, test } from 'vite-plus/test';
import type { Entry } from '@/data/data-store';
import { getEntryKind, Samples, type Value } from '@/data/samples';
import { createPane, type Pane, splitPane } from '@/panes/layout';
import {
	controllerPort,
	findController,
	hasControllerData,
	inferLayout,
	readController,
} from '@/widgets/controller/data';
import { nextController } from '@/widgets/controller/options';

function entry(name: string, type: string, value: Value): Entry {
	const samples = new Samples();
	samples.push(0, value);
	return { name, type, kind: getEntryKind(type), samples, metadata: {} };
}

function source(...entries: Entry[]): (name: string) => Entry | undefined {
	const byName = new Map(entries.map((item) => [item.name, item]));
	return (name) => byName.get(name);
}

/** WPILib's buttons, `pressed` are WPILib's button numbers, starting at 1 */
function wpilibButtons(port: number, count: number, pressed: number[]): Entry {
	return entry(
		`/DS:joystick${port}/buttons`,
		'boolean[]',
		Array.from({ length: count }, (_, index) => pressed.includes(index + 1)),
	);
}

const xboxAxes = (port: number) => entry(`/DS:joystick${port}/axes`, 'float[]', [0.5, -1, 0.25, 1, 0, 0]);

test('WPILib Xbox controller', () => {
	const entries = source(wpilibButtons(0, 10, [1, 6, 10]), xboxAxes(0), entry('/DS:joystick0/povs', 'int64[]', [45]));
	const controller = findController(0, entries)!;
	expect(inferLayout(controller)).toBe('xbox');

	const state = readController(controller, 'xbox', 0);
	expect([...state.pressed].toSorted()).toEqual(['faceDown', 'right', 'rightBumper', 'rightStick', 'up'].toSorted());
	expect(state.axes).toEqual({ leftX: 0.5, leftY: -1, leftTrigger: 0.25, rightTrigger: 1, rightX: 0, rightY: 0 });
});

test('PlayStation buttons and axes are numbered differently', () => {
	const entries = source(
		// Square, cross, and options
		wpilibButtons(1, 14, [1, 2, 10]),
		entry('/DS:joystick1/axes', 'float[]', [0, 0, 0.5, 0.25, 1, -0.5]),
	);
	const controller = findController(1, entries)!;
	expect(inferLayout(controller)).toBe('playstation');

	const state = readController(controller, 'playstation', 0);
	expect([...state.pressed].toSorted()).toEqual(['faceDown', 'faceLeft', 'start']);
	expect(state.axes).toMatchObject({ rightX: 0.5, rightY: -0.5, leftTrigger: 0.25, rightTrigger: 1 });
});

test('AdvantageKit bitmask buttons, preferred over WPILib', () => {
	const prefix = '/DriverStation/Joystick2/';
	const entries = source(
		// Buttons 2 (B) and 8 (Start)
		entry(`${prefix}ButtonValues`, 'int64', 0b1000_0010),
		entry(`${prefix}AxisValues`, 'float[]', [0, 0, 0, 0, 0, 0]),
		entry(`${prefix}POVs`, 'int64[]', [-1]),
		entry(`${prefix}Name`, 'string', 'Wireless Controller'),
		wpilibButtons(2, 10, [1]),
	);
	const controller = findController(2, entries)!;
	expect(inferLayout(controller)).toBe('playstation');
	expect([...readController(controller, 'xbox', 0).pressed].toSorted()).toEqual(['faceRight', 'start']);
});

test('2027 logs number buttons from 0 and put the D-pad on buttons', () => {
	const entries = source(
		// Face down, back, and D-pad left
		wpilibButtons(0, 26, [1, 5, 14]),
		entry('/DS:joystick0/axes', 'float[]', [0, 0, 0.5, -0.5, 0.25, 1]),
		entry('/DS:joystick0/povs', 'int64[]', [0]),
		entry('/DS:opMode', 'string', 'Teleop'),
	);
	const controller = findController(0, entries)!;
	// Every layout is numbered the same way, so the button count doesn't tell
	expect(inferLayout(controller)).toBeUndefined();

	const state = readController(controller, 'playstation', 0);
	expect([...state.pressed].toSorted()).toEqual(['back', 'faceDown', 'left']);
	expect(state.axes).toMatchObject({ rightX: 0.5, rightY: -0.5, leftTrigger: 0.25, rightTrigger: 1 });
});

test('Xbox controllers with 16 buttons, and Xbox names with "Wireless Controller"', () => {
	expect(inferLayout(findController(0, source(wpilibButtons(0, 16, []), xboxAxes(0))))).toBe('xbox');

	const prefix = '/DriverStation/Joystick0/';
	const named = source(
		entry(`${prefix}AxisValues`, 'float[]', [0, 0, 0, 0, 0, 0]),
		entry(`${prefix}Name`, 'string', 'Xbox Wireless Controller'),
	);
	expect(inferLayout(findController(0, named))).toBe('xbox');
});

test('inputs are released before the first sample', () => {
	const controller = findController(0, source(wpilibButtons(0, 10, [1]), xboxAxes(0)))!;
	const state = readController(controller, 'xbox', -1);
	expect(state.pressed.size).toBe(0);
	expect(state.axes.leftX).toBe(0);
});

test('ports without a controller have no data', () => {
	const empty = source(entry('/DS:joystick3/buttons', 'boolean[]', []), entry('/DS:joystick3/axes', 'float[]', []));
	expect(hasControllerData(findController(3, empty))).toBe(false);
	expect(findController(4, empty)).toBeUndefined();
});

test('controller port of an entry', () => {
	expect(controllerPort('/DS:joystick2/axes')).toBe(2);
	expect(controllerPort('/NT:/AdvantageKit/DriverStation/Joystick5/Name')).toBe(5);
	expect(controllerPort('/DriverStation/Enabled')).toBeUndefined();
	expect(controllerPort('/DS:joystick6/axes')).toBeUndefined();
});

function shown(port: string): Pane {
	return { ...createPane(), widget: { type: 'controller', config: { bindings: [], options: { controller: port } } } };
}

test('new controller widgets show the next plugged in controller', () => {
	const entries = source(wpilibButtons(1, 10, []), xboxAxes(1), wpilibButtons(4, 10, []), xboxAxes(4));
	expect(nextController(createPane(), entries)).toBe('1');

	const withFirst = shown('1');
	expect(nextController(withFirst, entries)).toBe('4');

	const withBoth = splitPane(withFirst, withFirst.id, 'row', shown('4'));
	expect(nextController(withBoth, entries)).toBe('0');
});
