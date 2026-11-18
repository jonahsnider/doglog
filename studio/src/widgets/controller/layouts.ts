import type { ControllerLayout } from '@/widgets/controller/data';

export type Point = readonly [x: number, y: number];

/** The SVG is 400 wide, the right side's shoulder controls mirror the left side's across x = 200 */
export const width = 400;

/** How each layout looks, in the SVG's units */
export type LayoutShape = {
	/** Outline of the controller's body, front view */
	readonly body: string;
	readonly leftStick: Point;
	readonly rightStick: Point;
	readonly face: Point;
	readonly dpad: Point;
	readonly back: Point;
	readonly start: Point;
	/** Back and Start are round on Xbox controllers and upright pills on PlayStation controllers */
	readonly menuShape: 'circle' | 'pill';
	/** Glyphs of the top, right, bottom, and left face buttons */
	readonly faceGlyphs: readonly [string, string, string, string];
	readonly bumpers: readonly [string, string];
	readonly triggers: readonly [string, string];
	readonly menuLabels: readonly [string, string];
	readonly touchpad: boolean;
};

export const layouts: Readonly<Record<ControllerLayout, LayoutShape>> = {
	xbox: {
		// Rounded shoulders, a dip between the grips
		body: 'M 200 70 C 236 70 262 62 296 62 C 336 62 360 82 372 116 C 386 156 398 210 396 240 C 394 268 368 282 346 270 C 326 260 314 238 298 218 C 288 204 272 196 250 196 L 150 196 C 128 196 112 204 102 218 C 86 238 74 260 54 270 C 32 282 6 268 4 240 C 2 210 14 156 28 116 C 40 82 64 62 104 62 C 138 62 164 70 200 70 Z',
		// Offset sticks: left stick high, D-pad and right stick low in the middle
		leftStick: [104, 118],
		rightStick: [248, 164],
		face: [296, 118],
		dpad: [152, 164],
		back: [176, 112],
		start: [224, 112],
		menuShape: 'circle',
		faceGlyphs: ['Y', 'B', 'A', 'X'],
		bumpers: ['LB', 'RB'],
		triggers: ['LT', 'RT'],
		menuLabels: ['Back', 'Start'],
		touchpad: false,
	},
	playstation: {
		// Flat top around the touchpad, longer grips
		body: 'M 200 62 L 262 62 C 300 62 330 60 352 72 C 372 84 380 110 386 140 C 394 182 400 226 396 250 C 392 276 366 286 346 274 C 328 262 316 236 302 216 C 294 206 282 202 268 202 L 132 202 C 118 202 106 206 98 216 C 84 236 72 262 54 274 C 34 286 8 276 4 250 C 0 226 6 182 14 140 C 20 110 28 84 48 72 C 70 60 100 62 138 62 Z',
		// Symmetric sticks below the D-pad and face buttons
		leftStick: [148, 172],
		rightStick: [252, 172],
		face: [306, 124],
		dpad: [94, 124],
		back: [134, 80],
		start: [266, 80],
		menuShape: 'pill',
		faceGlyphs: ['△', '○', '✕', '□'],
		bumpers: ['L1', 'R1'],
		triggers: ['L2', 'R2'],
		menuLabels: ['Share', 'Options'],
		touchpad: true,
	},
};
