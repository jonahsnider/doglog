// SVG shapes for the field widget, drawn in field meters with +Y up
import { type Pose, readShape } from '@/widgets/field-data';
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
export function Robot({ pose, color, ghost = false }: { pose: Pose; color: string; ghost?: boolean }) {
	const bodyHalf = robotHalf - bumperWidth;
	return (
		// Ghosts are see-through robots, ex. where the robot is trying to go
		<g
			transform={`translate(${pose.x} ${pose.y}) rotate(${toDegrees(pose.heading ?? 0)})`}
			opacity={ghost ? 0.35 : undefined}
		>
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

/** Every pose of a markers entry as a dot with a line toward its heading if it has one, drawn as one path each */
export function Markers({ poses, color }: { poses: Pose[]; color: string }) {
	const dots = poses
		.map(
			({ x, y }) =>
				`M ${x + markerRadius} ${y} A ${markerRadius} ${markerRadius} 0 1 0 ${x - markerRadius} ${y} A ${markerRadius} ${markerRadius} 0 1 0 ${x + markerRadius} ${y}`,
		)
		.join(' ');
	const headings = poses
		.map(({ x, y, heading }) =>
			heading === undefined
				? ''
				: `M ${x} ${y} L ${x + Math.cos(heading) * markerHeadingLength} ${y + Math.sin(heading) * markerHeadingLength}`,
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

/** Each Rectangle2d or Ellipse2d outlined over a light fill, rotated with its center */
export function Shapes({ values, color }: { values: readonly unknown[]; color: string }) {
	return (
		<>
			{values.map((value, index) => {
				const { kind, center, xRadius, yRadius } = readShape(value);
				const props = {
					fill: color,
					fillOpacity: 0.2,
					stroke: color,
					strokeWidth,
					vectorEffect: 'non-scaling-stroke',
				} as const;
				return (
					// oxlint-disable-next-line react/no-array-index-key -- Shapes have no identity besides their position
					<g key={index} transform={`translate(${center.x} ${center.y}) rotate(${toDegrees(center.heading ?? 0)})`}>
						{kind === 'rectangle' ? (
							<rect x={-xRadius} y={-yRadius} width={xRadius * 2} height={yRadius * 2} {...props} />
						) : (
							<ellipse rx={xRadius} ry={yRadius} {...props} />
						)}
					</g>
				);
			})}
		</>
	);
}

/** A line through the poses in order */
export function Path({ poses, color }: { poses: Pose[]; color: string }) {
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
