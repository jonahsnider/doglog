// SVG shapes for the field widget, drawn in field meters with +Y up
import type { Value } from '@/data/samples';
import { type FieldRole, type Pose, readPose } from '@/widgets/field-data';
import { strokeWidth, toDegrees } from '@/widgets/field-geometry';

/** Bumper footprint of a typical robot */
const robotHalf = 0.45;
/** Drawn a little thicker than real bumpers so they read at small sizes */
const bumperWidth = 0.1;
const markerRadius = 0.12;
const markerHeadingLength = 0.3;

/**
 * A robot like AdvantageScope draws one: bumpers in the entry's color around a dark body, with a white arrow toward its
 * front. Everything is sized in meters, so the robot keeps its look at any zoom.
 */
function Robot({ pose, color }: { pose: Pose; color: string }) {
	const bodyHalf = robotHalf - bumperWidth;
	return (
		<g transform={`translate(${pose.x} ${pose.y}) rotate(${toDegrees(pose.heading)})`}>
			<rect x={-robotHalf} y={-robotHalf} width={robotHalf * 2} height={robotHalf * 2} rx={0.06} fill={color} />
			<rect x={-bodyHalf} y={-bodyHalf} width={bodyHalf * 2} height={bodyHalf * 2} fill="#222" />
			<path
				d="M -0.2 0 L 0.2 0 M 0.08 0.12 L 0.2 0 L 0.08 -0.12"
				fill="none"
				stroke="white"
				strokeWidth={0.05}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</g>
	);
}

/** Every pose of a markers entry as a dot with a line toward its heading, drawn as one path each */
function Markers({ poses, color }: { poses: Pose[]; color: string }) {
	const dots = poses
		.map(
			({ x, y }) =>
				`M ${x + markerRadius} ${y} A ${markerRadius} ${markerRadius} 0 1 0 ${x - markerRadius} ${y} A ${markerRadius} ${markerRadius} 0 1 0 ${x + markerRadius} ${y}`,
		)
		.join(' ');
	const headings = poses
		.map(
			({ x, y, heading }) =>
				`M ${x} ${y} L ${x + Math.cos(heading) * markerHeadingLength} ${y + Math.sin(heading) * markerHeadingLength}`,
		)
		.join(' ');
	return (
		<>
			<path
				d={headings}
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
			<path d={dots} fill={color} />
		</>
	);
}

/** An entry's value at the cursor, drawn as its role */
export function Drawing({ role, value, color }: { role: FieldRole; value: Value; color: string }) {
	if (role === 'robot') {
		return <Robot pose={readPose(value)} color={color} />;
	}

	const poses = Array.isArray(value) ? value.map((item) => readPose(item)) : [];
	if (role === 'markers') {
		return <Markers poses={poses} color={color} />;
	}

	return (
		<polyline
			points={poses.map((pose) => `${pose.x},${pose.y}`).join(' ')}
			fill="none"
			stroke={color}
			strokeWidth={strokeWidth}
			strokeLinejoin="round"
			strokeLinecap="round"
			vectorEffect="non-scaling-stroke"
		/>
	);
}
