// Field widget math, in field meters with +Y up

// 2026 field, in meters. Drawings use WPILib's 2026 convention: the origin is the blue alliance wall's right corner, as
// seen from the blue driver stations, +X points toward red, and +Y points left from the blue driver stations.
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

function viewBounds(width: number, height: number) {
	return { x: -margin, y: -height - margin, width: width + margin * 2, height: height + margin * 2 };
}

const landscape = viewBounds(fieldLength, fieldWidth);
const portrait = viewBounds(fieldWidth, fieldLength);

/** A quarter-turn matrix shared by the SVG, pointer positions, and measurement labels. Points in blue-wall coordinates
 * have +Y up, while SVG points have +Y down. */
function fieldView(cos: number, sin: number, offsetX: number, offsetY: number) {
	const vertical = sin !== 0;
	const bounds = vertical ? portrait : landscape;
	return {
		bounds,
		vertical,
		aspectRatio: bounds.width / bounds.height,
		viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
		transform: `matrix(${cos} ${sin} ${-sin} ${cos} ${offsetX} ${offsetY})`,
		toSvg: ({ x, y }: FieldPoint): FieldPoint => ({
			x: cos * x + sin * y + offsetX,
			y: sin * x - cos * y + offsetY,
		}),
		fromSvg: ({ x, y }: FieldPoint): FieldPoint => ({
			x: cos * (x - offsetX) + sin * (y - offsetY),
			y: sin * (x - offsetX) - cos * (y - offsetY),
		}),
	};
}

export type FieldView = ReturnType<typeof fieldView>;

const blueLeft = fieldView(1, 0, 0, 0);
const fieldViews = new Map([
	['red-left', fieldView(-1, 0, fieldLength, -fieldWidth)],
	['blue-top', fieldView(0, 1, 0, -fieldLength)],
	['red-top', fieldView(0, -1, fieldWidth, 0)],
]);

export function orientedField(orientation: string | undefined): FieldView {
	return fieldViews.get(orientation ?? '') ?? blueLeft;
}

/**
 * The convention poses are logged in. `blue-wall` is WPILib 2026's, which drawings use. `center` is WPILib 2027's: the
 * origin is the field's center, and the axes are turned a half turn, so +X points toward blue.
 */
export type FieldCoordinates = 'blue-wall' | 'center';

/** Rotates SVG content in `center` coordinates into `blue-wall` ones, inside the flip that makes +Y point up */
export function coordinatesTransform(coordinates: FieldCoordinates): string | undefined {
	return coordinates === 'center' ? `translate(${fieldLength / 2} ${fieldWidth / 2}) rotate(180)` : undefined;
}

/** Converts between a point in `coordinates` and a `blue-wall` one, the same either way since it's a half turn */
export function toBlueWall(point: FieldPoint, coordinates: FieldCoordinates): FieldPoint {
	return coordinates === 'center' ? { x: fieldLength / 2 - point.x, y: fieldWidth / 2 - point.y } : point;
}

/** Counterclockwise angle on screen of the +X axis poses are logged in, in radians, ex. 0 when it points right */
export function xAxisAngle(field: FieldView, coordinates: FieldCoordinates): number {
	const origin = field.toSvg(toBlueWall({ x: 0, y: 0 }, coordinates));
	const end = field.toSvg(toBlueWall({ x: 1, y: 0 }, coordinates));
	// SVG +Y points down
	return Math.atan2(origin.y - end.y, end.x - origin.x);
}

/**
 * The coordinates a robot running `version` of WPILib logs poses in, from its `/Robot/WPILibVersion`. WPILib switched
 * to `center` after 2027's alpha releases, and older versions don't publish theirs.
 */
export function wpilibCoordinates(version: unknown): FieldCoordinates {
	if (typeof version !== 'string') {
		return 'blue-wall';
	}
	const year = Number(version.split('.')[0]);
	return year > 2027 || (year === 2027 && !version.includes('alpha')) ? 'center' : 'blue-wall';
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
