// Robot-frame geometry shared by the swerve widget and its shapes
import type { RobotDimensions } from '@/three/project-schema';

export const strokeWidth = 0.025;
export const headSize = 0.08;

/** Robot-frame point: +x is the robot's front, +y is its left */
export type Point = readonly [x: number, y: number];

/** Half the chassis's length and width, shaped like the robot's dimensions with its longer side 1 long */
export function chassisHalf({ length, width }: RobotDimensions): Point {
	const longest = Math.max(length, width);
	return [length / longest / 2, width / longest / 2];
}

/** SVG coordinates of a robot-frame point, with the robot's front pointing up */
export function toSvg([x, y]: Point): Point {
	return [-y, -x];
}

export function move([x, y]: Point, angle: number, distance: number): Point {
	return [x + Math.cos(angle) * distance, y + Math.sin(angle) * distance];
}
