// Reads a Driver Station controller's inputs from the entries WPILib or AdvantageKit log for it.
import type { Entry } from '@/data/data-store';
import { type Value, withoutNtPrefix } from '@/data/samples';

export type ControllerLayout = 'xbox' | 'playstation';

/**
 * How buttons and axes are numbered. `ni` is the NI Driver Station's numbering, with the D-pad as a POV in degrees.
 * `sdl` is the FRC Driver Station's (2027 onward), with the D-pad as buttons.
 */
type Mapping = 'ni' | 'sdl';

/** A controller's entries in the active source */
export type ControllerSource = {
	/** WPILib's `boolean[]` of buttons, or AdvantageKit's bitmask of them */
	readonly buttons: Entry | undefined;
	readonly axes: Entry | undefined;
	/** POVs in degrees, -1 when not pressed, only read with the `ni` mapping */
	readonly povs: Entry | undefined;
	readonly mapping: Mapping;
	/** AdvantageKit's controller name, ex. `Wireless Controller` for a PS4 controller */
	readonly name: Entry | undefined;
	/** AdvantageKit's flag for Xbox controllers */
	readonly xbox: Entry | undefined;
	/** AdvantageKit's button count, WPILib's is the length of its buttons */
	readonly buttonCount: Entry | undefined;
};

/** AdvantageKit's prefixes for a controller's entries, in a log and over NetworkTables */
const advantageKitPrefixes = ['/DriverStation/Joystick', '/AdvantageKit/DriverStation/Joystick'];

const wpilibPrefix = '/DS:joystick';

/** The controller port an entry belongs to, ex. 2 for `/DS:joystick2/axes`, `undefined` for other entries */
export function controllerPort(name: string): number | undefined {
	const bare = withoutNtPrefix(name);
	for (const prefix of [...advantageKitPrefixes, wpilibPrefix]) {
		const match = bare.startsWith(prefix) ? /^([0-5])\//u.exec(bare.slice(prefix.length)) : null;
		if (match) {
			return Number(match[1]);
		}
	}
	return undefined;
}

/**
 * A controller's entries, from the first of AdvantageKit's log, AdvantageKit's NetworkTables, or WPILib's Driver Station
 * log that has them. `undefined` when the source has none.
 */
export function findController(
	port: number,
	entryOf: (name: string) => Entry | undefined,
): ControllerSource | undefined {
	for (const prefix of advantageKitPrefixes) {
		const field = (name: string) => entryOf(`${prefix}${port}/${name}`);
		const buttons = field('ButtonValues');
		const axes = field('AxisValues');
		if (buttons || axes) {
			return {
				buttons,
				axes,
				povs: field('POVs'),
				// AdvantageKit's 2027 releases log which buttons are available
				mapping: field('ButtonsAvailable') ? 'sdl' : 'ni',
				name: field('Name'),
				xbox: field('Xbox'),
				buttonCount: field('ButtonCount'),
			};
		}
	}

	const field = (name: string) => entryOf(`${wpilibPrefix}${port}/${name}`);
	const buttons = field('buttons');
	const axes = field('axes');
	if (!buttons && !axes) {
		return undefined;
	}
	return {
		buttons,
		axes,
		povs: field('povs'),
		// WPILib's 2027 releases log the operating mode
		mapping: entryOf('/DS:opMode') ? 'sdl' : 'ni',
		name: undefined,
		xbox: undefined,
		buttonCount: undefined,
	};
}

function values(entry: Entry | undefined): Value[] {
	return entry ? entry.samples.values() : [];
}

/** Whether a controller was ever plugged in, logs have empty values for every port without one */
export function hasControllerData(source: ControllerSource | undefined): boolean {
	const samples = source?.axes?.samples;
	// Checked as the widget renders, so it stops at the first value and counts items without making each array
	for (let index = 0; index < (samples?.length ?? 0); index++) {
		if (samples!.lengthAt(index) > 0) {
			return true;
		}
	}
	return false;
}

/** The name the Driver Station gives PS4 controllers, and names of other PlayStation controllers */
const playStationName = /^wireless controller$|dualshock|dualsense|playstation|ps[45]/iu;

/**
 * The layout of a controller, from AdvantageKit's name and Xbox flag, or from its button count: the NI Driver Station
 * reports 14 buttons for PS4 controllers, and 10 or 16 for Xbox controllers. `undefined` when nothing tells.
 */
export function inferLayout(source: ControllerSource | undefined): ControllerLayout | undefined {
	if (!source) {
		return undefined;
	}

	if (values(source.xbox).includes(true)) {
		return 'xbox';
	}
	const names = values(source.name).filter((value): value is string => typeof value === 'string' && value !== '');
	if (names.length > 0) {
		return names.some((name) => playStationName.test(name.trim())) ? 'playstation' : 'xbox';
	}

	// Buttons are numbered the same way for every layout with the `sdl` mapping
	if (source.mapping === 'sdl') {
		return undefined;
	}
	const counts = (
		source.buttonCount
			? values(source.buttonCount).filter((value) => typeof value === 'number')
			: values(source.buttons).map((value) => (Array.isArray(value) ? value.length : 0))
	).filter((count) => count > 0);
	if (counts.length === 0) {
		return undefined;
	}
	// Other controllers can be plugged into the same port during a log, only call it a PlayStation controller if it always was
	return counts.every((count) => count === 14) ? 'playstation' : 'xbox';
}

const controllerButtons = [
	'faceDown',
	'faceRight',
	'faceLeft',
	'faceUp',
	'leftBumper',
	'rightBumper',
	'back',
	'start',
	'leftStick',
	'rightStick',
	'up',
	'right',
	'down',
	'left',
] as const;

export type ControllerButton = (typeof controllerButtons)[number];

type ControllerAxis = 'leftX' | 'leftY' | 'rightX' | 'rightY' | 'leftTrigger' | 'rightTrigger';

/** What a controller is doing, sticks are -1 to 1 with +Y down, triggers are 0 to 1 */
export type ControllerState = {
	readonly pressed: ReadonlySet<ControllerButton>;
	readonly axes: Readonly<Record<ControllerAxis, number>>;
};

type ButtonIndices = Partial<Readonly<Record<ControllerButton, number>>>;
type AxisIndices = Readonly<Record<ControllerAxis, number>>;

// Button indices start at 0, WPILib's button numbers with the `ni` mapping start at 1
const niButtons: Readonly<Record<ControllerLayout, ButtonIndices>> = {
	xbox: {
		faceDown: 0,
		faceRight: 1,
		faceLeft: 2,
		faceUp: 3,
		leftBumper: 4,
		rightBumper: 5,
		back: 6,
		start: 7,
		leftStick: 8,
		rightStick: 9,
	},
	// Square, cross, circle, triangle, L1, R1, then L2 and R2 as buttons, which are also axes
	playstation: {
		faceLeft: 0,
		faceDown: 1,
		faceRight: 2,
		faceUp: 3,
		leftBumper: 4,
		rightBumper: 5,
		back: 8,
		start: 9,
		leftStick: 10,
		rightStick: 11,
	},
};

const sdlButtons: ButtonIndices = {
	faceDown: 0,
	faceRight: 1,
	faceLeft: 2,
	faceUp: 3,
	back: 4,
	start: 6,
	leftStick: 7,
	rightStick: 8,
	leftBumper: 9,
	rightBumper: 10,
	up: 11,
	down: 12,
	left: 13,
	right: 14,
};

const niAxes: Readonly<Record<ControllerLayout, AxisIndices>> = {
	xbox: { leftX: 0, leftY: 1, leftTrigger: 2, rightTrigger: 3, rightX: 4, rightY: 5 },
	playstation: { leftX: 0, leftY: 1, rightX: 2, leftTrigger: 3, rightTrigger: 4, rightY: 5 },
};

const sdlAxes: AxisIndices = { leftX: 0, leftY: 1, rightX: 2, rightY: 3, leftTrigger: 4, rightTrigger: 5 };

/** Whether button `index` is pressed in WPILib's `boolean[]` or AdvantageKit's bitmask */
function isPressed(buttons: Value | undefined, index: number): boolean {
	if (Array.isArray(buttons)) {
		return buttons[index] === true;
	}
	// Bitmasks can be wider than JavaScript's 32-bit bitwise operators
	return typeof buttons === 'number' && Math.floor(buttons / 2 ** index) % 2 === 1;
}

/** D-pad directions pressed for a POV angle in degrees, diagonals press two */
function povDirections(degrees: number): ControllerButton[] {
	if (degrees < 0) {
		return [];
	}
	const directions: [ControllerButton, number][] = [
		['up', 0],
		['right', 90],
		['down', 180],
		['left', 270],
	];
	return directions
		.filter(([, center]) => Math.abs(((degrees - center + 540) % 360) - 180) <= 45)
		.map(([direction]) => direction);
}

/** A controller's inputs at `time`, inputs without a sample yet are released or centered */
export function readController(
	source: ControllerSource,
	layout: ControllerLayout,
	time: number | undefined,
): ControllerState {
	const valueAt = (entry: Entry | undefined) => (entry && time !== undefined ? entry.samples.valueAt(time) : undefined);
	const buttons = valueAt(source.buttons);
	const axisValues = valueAt(source.axes);
	const buttonIndices = source.mapping === 'sdl' ? sdlButtons : niButtons[layout];
	const axisIndices = source.mapping === 'sdl' ? sdlAxes : niAxes[layout];

	const pressed = new Set<ControllerButton>();
	for (const button of controllerButtons) {
		const index = buttonIndices[button];
		if (index !== undefined && isPressed(buttons, index)) {
			pressed.add(button);
		}
	}
	if (source.mapping === 'ni') {
		const povs = valueAt(source.povs);
		const pov = Array.isArray(povs) ? povs[0] : undefined;
		for (const direction of typeof pov === 'number' ? povDirections(pov) : []) {
			pressed.add(direction);
		}
	}

	const axis = (name: ControllerAxis) => {
		const value = Array.isArray(axisValues) ? axisValues[axisIndices[name]] : undefined;
		return typeof value === 'number' ? value : 0;
	};
	return {
		pressed,
		axes: {
			leftX: axis('leftX'),
			leftY: axis('leftY'),
			rightX: axis('rightX'),
			rightY: axis('rightY'),
			leftTrigger: axis('leftTrigger'),
			rightTrigger: axis('rightTrigger'),
		},
	};
}
