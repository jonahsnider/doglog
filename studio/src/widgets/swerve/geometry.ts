// Robot-frame geometry shared by the swerve widget and its shapes
export const chassisHalf = 0.5;
export const strokeWidth = 0.025;
export const headSize = 0.08;

/** Robot-frame point: +x is the robot's front, +y is its left */
export type Point = readonly [x: number, y: number];

/** SVG coordinates of a robot-frame point, with the robot's front pointing up */
export function toSvg([x, y]: Point): Point {
	return [-y, -x];
}

export function move([x, y]: Point, angle: number, distance: number): Point {
	return [x + Math.cos(angle) * distance, y + Math.sin(angle) * distance];
}
