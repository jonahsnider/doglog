// Field widget math, in field meters with +Y up

// 2026 field, in meters. Poses use WPILib's 2026 convention: the origin is the blue alliance wall's right corner, as seen
// from the blue driver stations, +X points toward red, and +Y points left from the blue driver stations.
const fieldLength = 16.541;
const fieldWidth = 8.069;
/**
 * Image size and the field boundary's edges in image pixels, measured where the image turns opaque at the inside faces
 * of the alliance walls and guardrails. The image has red on the left.
 */
export const image = { width: 3901, height: 1583, left: 523, top: 94, right: 3377, bottom: 1489 };
export const pixelsPerMeterX = (image.right - image.left) / fieldLength;
export const pixelsPerMeterY = (image.bottom - image.top) / fieldWidth;
/** Behind the transparent image in every theme, close to the render's own background */
export const fieldBackground = '#6f6f6f';

// The view shows blue on the left, so +X points right, +Y points up, and the origin is the boundary's bottom left.
// SVG coordinates are field meters with Y flipped, the image is rotated a half turn to put blue on the left.
/** Shown around the field boundary on every side, the guardrails' margin in the image, so the driver stations are cropped */
const margin = image.top / pixelsPerMeterY;
export const view = {
	x: -margin,
	y: -(fieldWidth + margin),
	width: fieldLength + margin * 2,
	height: fieldWidth + margin * 2,
};

export const aspectRatio = view.width / view.height;

/** Which alliance is on the left of the view, the field is rotated a half turn to put red on the left */
export type FieldOrientation = 'blue-left' | 'red-left';

/** Rotates SVG content a half turn around the field's center for `red-left` */
export function orientationTransform(orientation: FieldOrientation): string | undefined {
	return orientation === 'red-left' ? `rotate(180 ${fieldLength / 2} ${-fieldWidth / 2})` : undefined;
}

/** Converts between a field point and where it's drawn in the blue-left view, the same either way since it's a half turn */
export function orient(point: FieldPoint, orientation: FieldOrientation): FieldPoint {
	return orientation === 'red-left' ? { x: fieldLength - point.x, y: fieldWidth - point.y } : point;
}

/** Stroke width of lines on the field in meters, so they zoom with the field like robots do */
export const strokeWidth = 0.08;

export function toDegrees(radians: number): number {
	return (radians * 180) / Math.PI;
}

export type MeasureTool = 'distance' | 'angle';

export type FieldPoint = { x: number; y: number };

/** A line dragged from `from` to `to`, measured as its length or its angle from +X */
export type Measurement = { tool: MeasureTool; from: FieldPoint; to: FieldPoint };

/** `to` moved to the nearest 45° line through `from`, keeping its distance */
export function snapTo45(from: FieldPoint, to: FieldPoint): FieldPoint {
	const step = Math.PI / 4;
	const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}

const maxArcRadius = 1.5;

export function arcRadius({ from, to }: Measurement): number {
	return Math.min(Math.hypot(to.x - from.x, to.y - from.y) / 2, maxArcRadius);
}

export function angleOf({ from, to }: Measurement): number {
	return Math.atan2(to.y - from.y, to.x - from.x);
}

/** The measurement's text and where it's shown */
export function measurementLabel(measurement: Measurement): { text: string; at: FieldPoint } {
	const { from, to } = measurement;
	if (measurement.tool === 'distance') {
		return {
			text: `${Math.hypot(to.x - from.x, to.y - from.y).toFixed(2)} m`,
			at: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
		};
	}
	// Counterclockwise from +X like a WPILib Rotation2d, past the middle of the arc so it doesn't cover the line
	const angle = angleOf(measurement);
	const labelRadius = arcRadius(measurement) + 0.4;
	return {
		text: `${toDegrees(angle).toFixed(1)}°`,
		at: { x: from.x + Math.cos(angle / 2) * labelRadius, y: from.y + Math.sin(angle / 2) * labelRadius },
	};
}
