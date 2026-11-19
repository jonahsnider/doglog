import CompassIcon from 'lucide-react/icons/compass';
import type { ReactNode } from 'react';
import type { Value } from '@/data/samples';
import { type Entry, useDataVersion } from '@/data/data-store';
import { angleUnitLabels, inferAngleUnit, toRadians } from '@/data/units';
import { useCursorTime } from '@/timeline/timeline';
import { numberField } from '@/data/struct-fields';
import { historyMax, isSpeeds, type Module, readModules, swerveRole } from '@/widgets/swerve/data';
import { chassisHalf, move, type Point, strokeWidth } from '@/widgets/swerve/geometry';
import { Arrow, Line, ModuleLabel, RotationArc, Wheel } from '@/widgets/swerve/shapes';
import type { WidgetProps } from '@/widgets/widget-type';
import { Legend, type LegendItem } from '@/widgets/legend/legend';
import { bindingColor } from '@/widgets/series-color';

// Sizes in robot-frame meters-like units: the chassis is 1 wide, the view leaves room for arrows when it's rotated
/** Modules sit inside the chassis, like a real robot's */
const moduleOffset = 0.36;
/** Arrow length at zero speed, so stopped modules still show a full-shape arrow past the wheel */
const baseArrow = 0.2;
/** Arrow length at the fastest speed in the bound entries' history */
const fullArrow = 0.55;
const positionLine = 0.25;
const viewHalf = 1.1;
/** Largest rotation arc, for the fastest rotation in an entry's history */
const maxSweep = (Math.PI * 3) / 2;

/** Front-left, front-right, back-left, back-right, matching WPILib's usual module order */
const modulePositions: readonly Point[] = [
	[moduleOffset, moduleOffset],
	[moduleOffset, -moduleOffset],
	[-moduleOffset, moduleOffset],
	[-moduleOffset, -moduleOffset],
];
const moduleLabels = ['FL', 'FR', 'BL', 'BR'];

function ChassisSpeeds({
	value,
	fieldRelative,
	heading,
	maxOmega,
	arrowLength,
	arcRadius,
	color,
}: {
	value: Value;
	fieldRelative: boolean;
	/** Robot heading, turns field-relative speeds into the robot frame */
	heading: number;
	maxOmega: number;
	arrowLength: (speed: number) => number;
	arcRadius: number;
	color: string;
}) {
	const vx = numberField(value, 'vx');
	const vy = numberField(value, 'vy');
	const speed = Math.hypot(vx, vy);
	// Without a heading entry the heading is 0, so field +X points up like the robot's front
	const angle = Math.atan2(vy, vx) - (fieldRelative ? heading : 0);
	return (
		<g>
			{speed > 0 && <Arrow from={[0, 0]} angle={angle} length={arrowLength(speed)} color={color} />}
			<RotationArc
				radius={arcRadius}
				sweep={maxOmega > 0 ? (numberField(value, 'omega') / maxOmega) * maxSweep : 0}
				color={color}
			/>
		</g>
	);
}

/** Arrows for module states or lines for module positions, optionally over translucent wheels in the entry's color */
function ModuleLayer({
	modules,
	isPositions,
	showWheels,
	arrowLength,
	color,
}: {
	modules: Module[];
	isPositions: boolean;
	showWheels: boolean;
	arrowLength: (speed: number) => number;
	color: string;
}) {
	const arrows = modules.map((module, index) => {
		const position = modulePositions[index]!;
		const key = moduleLabels[index];
		if (isPositions) {
			return <Line key={key} from={position} to={move(position, module.angle, positionLine)} color={color} />;
		}
		return (
			<Arrow
				key={key}
				from={position}
				// Negative speeds drive the opposite way the module points
				angle={module.angle + (module.speed < 0 ? Math.PI : 0)}
				// Stopped modules still show the base arrow, so arrows don't flicker when a speed briefly reads 0
				length={arrowLength(module.speed)}
				color={color}
			/>
		);
	});
	return (
		<g>
			{showWheels &&
				modules.map((module, index) => (
					<Wheel key={moduleLabels[index]} position={modulePositions[index]!} angle={module.angle} color={color} />
				))}
			{arrows}
		</g>
	);
}

/** Arrow length for a speed, growing linearly from the base length so every speed difference is visible */
function scaledArrowLength(speed: number, maxSpeed: number): number {
	return baseArrow + (maxSpeed > 0 ? (Math.abs(speed) / maxSpeed) * (fullArrow - baseArrow) : 0);
}

/** Fastest speed in the history of every shown module state and chassis speeds entry, for the arrow scale */
function maxBoundSpeed(bindings: WidgetProps['bindings']): number {
	let maxSpeed = 0;
	for (const binding of bindings) {
		const role = swerveRole(binding);
		if (binding.entry && !binding.hidden && (role === 'states' || isSpeeds(role))) {
			maxSpeed = Math.max(maxSpeed, historyMax(binding.entry, role).speed);
		}
	}
	return maxSpeed;
}

/** Robot heading in radians, with the front pointing up when there's no heading value */
function headingRadians(value: Value | undefined, entry: Entry | undefined): number {
	if (value === undefined || entry === undefined) {
		return 0;
	}
	return typeof value === 'number' ? toRadians(value, inferAngleUnit(entry)) : numberField(value, 'value');
}

export function Swerve({ bindings }: WidgetProps) {
	const time = useCursorTime();
	// Values at the cursor and the arrow scale change as samples arrive
	useDataVersion();

	const valueOf = (entry: Entry | undefined) => (entry && time !== undefined ? entry.samples.valueAt(time) : undefined);
	// Hidden headings are skipped, so hiding the first heading uses the next one
	const headingBinding = bindings.find((binding) => !binding.hidden && swerveRole(binding) === 'heading');
	const headingEntry = headingBinding?.entry;
	const heading = headingRadians(valueOf(headingEntry), headingEntry);

	const maxSpeed = maxBoundSpeed(bindings);
	const arrowLength = (speed: number) => scaledArrowLength(speed, maxSpeed);

	let wheelAngles: number[] | undefined;
	// Chassis speeds arrows and arcs, drawn on top of everything else
	const speedDrawings: ReactNode[] = [];
	// Arrows of the first module entry, drawn on its wheels
	let primaryArrows: ReactNode;
	// Later module entries, each a translucent wheel under its arrows, all under the first entry's wheels
	const extraLayers: ReactNode[] = [];
	const legend: LegendItem[] = [];
	let colorIndex = 0;
	let speedsIndex = 0;

	for (const binding of bindings) {
		const { id, entry } = binding;
		const role = swerveRole(binding);
		const value = valueOf(entry);

		if (role === 'heading') {
			legend.push({
				binding,
				icon: <CompassIcon className="size-3.5 shrink-0 text-muted-foreground" />,
				note: `(${angleUnitLabels[inferAngleUnit(entry!)]})`,
				dimmed: binding !== headingBinding || value === undefined,
			});
			continue;
		}

		// Counted for hidden bindings and picked colors too, so hiding or recoloring one doesn't recolor the others
		const autoColor = colorIndex++;
		const color = bindingColor(binding, autoColor);
		if (!entry || value === undefined || binding.hidden) {
			legend.push({ binding, color, dimmed: value === undefined });
			continue;
		}

		if (isSpeeds(role)) {
			speedDrawings.push(
				<ChassisSpeeds
					key={id}
					value={value}
					fieldRelative={role === 'fieldSpeeds'}
					heading={heading}
					maxOmega={historyMax(entry, role).omega}
					arrowLength={arrowLength}
					// Separate the arcs of multiple chassis speeds entries
					arcRadius={0.2 + speedsIndex * 0.06}
					color={color}
				/>,
			);
			speedsIndex++;
			legend.push({ binding, color, dimmed: false });
			continue;
		}

		const modules = readModules(value, role!);
		if (modules.length !== modulePositions.length) {
			legend.push({
				binding,
				color,
				dimmed: true,
				error: `expected ${modulePositions.length} modules, got ${modules.length}`,
			});
			continue;
		}

		const isPrimary = wheelAngles === undefined;
		const layer = (
			<ModuleLayer
				key={id}
				modules={modules}
				isPositions={role === 'positions'}
				showWheels={!isPrimary}
				arrowLength={arrowLength}
				color={color}
			/>
		);
		if (isPrimary) {
			wheelAngles = modules.map((module) => module.angle);
			primaryArrows = layer;
		} else {
			extraLayers.push(layer);
		}
		legend.push({ binding, color, dimmed: false });
	}

	return (
		<div className="flex h-full flex-col gap-2 p-2">
			<Legend items={legend} />
			<svg
				className="min-h-0 w-full flex-1"
				viewBox={`${-viewHalf} ${-viewHalf} ${viewHalf * 2} ${viewHalf * 2}`}
				role="img"
				aria-label="Swerve drive"
			>
				{/* Field +X points up, counterclockwise headings are negative SVG rotations */}
				<g transform={`rotate(${(-heading * 180) / Math.PI})`}>
					<rect
						x={-chassisHalf}
						y={-chassisHalf}
						width={chassisHalf * 2}
						height={chassisHalf * 2}
						rx={0.04}
						fill="none"
						className="stroke-border"
						strokeWidth={strokeWidth}
					/>
					{/* Earlier entries draw on top of later ones */}
					{extraLayers.toReversed()}
					{modulePositions.map((position, index) => (
						<g key={moduleLabels[index]}>
							<Wheel position={position} angle={wheelAngles?.[index] ?? 0} />
							<ModuleLabel position={position} label={moduleLabels[index]!} heading={heading} />
						</g>
					))}
					{primaryArrows}
					{speedDrawings.toReversed()}
				</g>
			</svg>
		</div>
	);
}
