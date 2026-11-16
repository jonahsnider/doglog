// SVG shapes for the swerve widget, drawn in robot-frame coordinates
import { chassisHalf, headSize, move, type Point, strokeWidth, toSvg } from '@/widgets/swerve-geometry';

function ArrowHead({ tip, angle, color }: { tip: Point; angle: number; color: string }) {
	const back = move(tip, angle, -headSize);
	const points = [
		tip,
		move(back, angle + Math.PI / 2, headSize * 0.6),
		move(back, angle - Math.PI / 2, headSize * 0.6),
	];
	return <polygon points={points.map((point) => toSvg(point).join(',')).join(' ')} fill={color} />;
}

export function Line({ from, to, color }: { from: Point; to: Point; color: string }) {
	const [x1, y1] = toSvg(from);
	const [x2, y2] = toSvg(to);
	return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />;
}

export function Arrow({ from, angle, length, color }: { from: Point; angle: number; length: number; color: string }) {
	const halfWidth = strokeWidth / 2;
	const headHalfWidth = headSize * 0.6;
	const neck = move(from, angle, length - headSize);
	const side = angle + Math.PI / 2;
	const points = [
		move(from, side, halfWidth),
		move(neck, side, halfWidth),
		move(neck, side, headHalfWidth),
		move(from, angle, length),
		move(neck, side, -headHalfWidth),
		move(neck, side, -halfWidth),
		move(from, side, -halfWidth),
	];
	return <polygon points={points.map((point) => toSvg(point).join(',')).join(' ')} fill={color} />;
}

/** Counterclockwise arc from the robot's front for positive `sweep` (radians) */
export function RotationArc({ radius, sweep, color }: { radius: number; sweep: number; color: string }) {
	if (Math.abs(sweep) < 0.01) {
		return null;
	}
	const [startX, startY] = toSvg([radius, 0]);
	const end = move([0, 0], sweep, radius);
	const [endX, endY] = toSvg(end);
	// Counterclockwise on screen is SVG's negative sweep direction
	const path = `M ${startX} ${startY} A ${radius} ${radius} 0 ${Math.abs(sweep) > Math.PI ? 1 : 0} ${sweep > 0 ? 0 : 1} ${endX} ${endY}`;
	return (
		<>
			<path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
			<ArrowHead tip={end} angle={sweep + (Math.sign(sweep) * Math.PI) / 2} color={color} />
		</>
	);
}

/** Module name outside the chassis corner, kept upright when the robot rotates by `heading` (radians) */
export function ModuleLabel({ position: [x, y], label, heading }: { position: Point; label: string; heading: number }) {
	// Just outside the chassis corner nearest the module
	const offset = chassisHalf + 0.08;
	const [labelX, labelY] = toSvg([Math.sign(x) * offset, Math.sign(y) * offset]);
	return (
		<text
			x={labelX}
			y={labelY}
			transform={`rotate(${(heading * 180) / Math.PI} ${labelX} ${labelY})`}
			textAnchor="middle"
			dominantBaseline="central"
			fontSize={0.09}
			className="fill-muted-foreground font-mono"
		>
			{label}
		</text>
	);
}

/** A module's wheel, gray for the first module entry or a translucent `color` for later ones */
export function Wheel({ position, angle, color }: { position: Point; angle: number; color?: string }) {
	const [x, y] = toSvg(position);
	return (
		<rect
			x={-0.045}
			y={-0.1}
			width={0.09}
			height={0.2}
			rx={0.02}
			// The wheel is drawn pointing up (the robot's front), counterclockwise robot angles are negative SVG rotations
			transform={`translate(${x} ${y}) rotate(${(-angle * 180) / Math.PI})`}
			className={color === undefined ? 'fill-muted stroke-muted-foreground' : undefined}
			fill={color}
			fillOpacity={color === undefined ? undefined : 0.3}
			stroke={color}
			strokeOpacity={color === undefined ? undefined : 0.8}
			strokeWidth={strokeWidth / 2}
		/>
	);
}
