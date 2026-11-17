// Distance and angle measurements on the field widget, in field meters with +Y up
import { angleOf, arcRadius, type Measurement, strokeWidth } from '@/widgets/field/geometry';

/** A white line with a dark outline, readable on every part of the field */
function OutlinedPath({ d, dashed = false }: { d: string; dashed?: boolean }) {
	const dash = dashed ? '0.2 0.2' : undefined;
	return (
		<>
			<path
				d={d}
				fill="none"
				stroke="black"
				strokeOpacity={0.6}
				strokeWidth={strokeWidth * 2}
				strokeLinecap="round"
				strokeDasharray={dash}
			/>
			<path d={d} fill="none" stroke="white" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={dash} />
		</>
	);
}

export function MeasurementDrawing({ measurement }: { measurement: Measurement }) {
	const { from, to } = measurement;
	const line = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
	if (measurement.tool === 'distance') {
		return <OutlinedPath d={line} />;
	}

	const angle = angleOf(measurement);
	const radius = arcRadius(measurement);
	// A positive sweep turns from +X toward +Y, which is counterclockwise on screen
	const arc = `M ${from.x + radius} ${from.y} A ${radius} ${radius} 0 0 ${angle > 0 ? 1 : 0} ${from.x + Math.cos(angle) * radius} ${from.y + Math.sin(angle) * radius}`;
	return (
		<>
			{/* Field +X from the vertex, where the angle is measured from */}
			<OutlinedPath d={`M ${from.x} ${from.y} l ${radius * 1.4} 0`} dashed />
			<OutlinedPath d={arc} />
			<OutlinedPath d={line} />
		</>
	);
}
