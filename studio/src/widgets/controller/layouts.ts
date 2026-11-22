import type { ControllerLayout } from '@/widgets/controller/data';

export type Point = readonly [x: number, y: number];

/** The SVG's size, the right side's shoulder controls mirror the left side's across its center */
export const width = 360;
export const height = 266;

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
		body: 'M 180 64 C 160 64 140 54 110 52 C 74 50 48 64 36 90 C 24 118 12 168 10 206 C 8 238 24 258 46 258 C 64 258 76 246 88 228 C 100 210 112 196 136 194 C 150 193 165 193 180 193 C 195 193 210 193 224 194 C 248 196 260 210 272 228 C 284 246 296 258 314 258 C 336 258 352 238 350 206 C 348 168 336 118 324 90 C 312 64 286 50 250 52 C 220 54 200 64 180 64 Z',
		// Offset sticks: left stick high, D-pad and right stick low in the middle
		leftStick: [86, 108],
		rightStick: [224, 158],
		face: [274, 108],
		dpad: [136, 158],
		back: [154, 104],
		start: [206, 104],
		menuShape: 'circle',
		faceGlyphs: ['Y', 'B', 'A', 'X'],
		bumpers: ['LB', 'RB'],
		triggers: ['LT', 'RT'],
		menuLabels: ['Back', 'Start'],
		touchpad: false,
	},
	playstation: {
		// Flat top around the touchpad, longer grips
		body: 'M 180 56 L 120 56 C 88 56 64 54 46 64 C 30 74 22 98 18 124 C 12 162 6 206 8 230 C 10 252 30 264 50 256 C 66 250 76 232 88 214 C 98 202 108 196 124 196 L 180 196 L 236 196 C 252 196 262 202 272 214 C 284 232 294 250 310 256 C 330 264 350 252 352 230 C 354 206 348 162 342 124 C 338 98 330 74 314 64 C 296 54 272 56 240 56 L 180 56 Z',
		// Symmetric sticks below the D-pad and face buttons
		leftStick: [134, 160],
		rightStick: [226, 160],
		face: [282, 112],
		dpad: [78, 112],
		back: [116, 80],
		start: [244, 80],
		menuShape: 'pill',
		faceGlyphs: ['△', '○', '✕', '□'],
		bumpers: ['L1', 'R1'],
		triggers: ['L2', 'R2'],
		menuLabels: ['Share', 'Options'],
		touchpad: true,
	},
};
