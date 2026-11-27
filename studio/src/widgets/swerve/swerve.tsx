import { colorVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import CompassIcon from 'lucide-react/icons/compass';
import type { ReactNode } from 'react';
import type { Value } from '@/data/samples';
import { type Entry, useDataVersion } from '@/data/data-store';
import { angleUnitLabels, inferAngleUnit, toRadians } from '@/data/units';
import { useMobileLayout } from '@/lib/mobile-layout';
import { useRobotDimensions } from '@/three/robot-projects';
import { useCursorTime } from '@/timeline/timeline';
import { numberField, structField } from '@/data/struct-fields';
import { readPose } from '@/widgets/field/data';
import { fieldXAxisAngle } from '@/widgets/field/options';
import { historyMax, isSpeeds, type Module, readModules, swerveRole } from '@/widgets/swerve/data';
import { chassisHalf, move, type Point, strokeWidth } from '@/widgets/swerve/geometry';
import { Arrow, ChassisSpeeds, Line, ModuleLabel, Wheel } from '@/widgets/swerve/shapes';
import type { WidgetProps } from '@/widgets/widget-type';
import type { PaneNode } from '@/panes/layout';
import { Legend, type LegendItem } from '@/widgets/legend/legend';
import { bindingColor } from '@/widgets/series-color';

const styles = stylex.create({
	swerve: {
		display: 'flex',
		height: '100%',
		flexDirection: 'column',
		gap: spacingVars['--spacing-2'],
		padding: spacingVars['--spacing-2'],
	},
	drawing: {
		minHeight: 0,
		width: '100%',
		flex: 1,
	},
	chassis: {
		stroke: colorVars['--color-border'],
	},
	headingIcon: {
		width: 14,
		height: 14,
		flexShrink: 0,
		color: colorVars['--color-icon-secondary'],
	},
});

// Sizes in robot-frame meters-like units: the chassis's longer side is 1 long, the view leaves room for arrows when
// it's rotated
/** How far modules sit inside the chassis's corners, like a real robot's */
const moduleInset = 0.14;
/** Arrow length at zero speed, so stopped modules still show a full-shape arrow past the wheel */
const baseArrow = 0.2;
/** Arrow length at the fastest speed in the bound entries' history */
const fullArrow = 0.55;
const positionLine = 0.25;
const viewHalf = 1.1;

/** Front-left, front-right, back-left, back-right, matching WPILib's usual module order */
const moduleCorners: readonly Point[] = [
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1],
];
const moduleLabels = ['FL', 'FR', 'BL', 'BR'];
const headingIcon = <CompassIcon {...stylex.props(styles.headingIcon)} />;

/** Arrows for module states or lines for module positions, optionally over translucent wheels in the entry's color */
function ModuleLayer({
	modules,
	modulePositions,
	isPositions,
	showWheels,
	arrowLength,
	color,
}: {
	modules: Module[];
	modulePositions: readonly Point[];
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

/** Robot heading in radians, 0 when there's no heading value */
function headingRadians(value: Value | undefined, entry: Entry | undefined): number {
	if (value === undefined || entry === undefined) {
		return 0;
	}
	if (typeof value === 'number') {
		return toRadians(value, inferAngleUnit(entry));
	}
	// Poses are headings too, ex. `/Drive/Pose` shown on a field
	return structField(value, 'rotation') === undefined ? numberField(value, 'value') : (readPose(value).heading ?? 0);
}

/**
 * Counterclockwise turn of the drivetrain from its front pointing up. A heading from a pose shown on a field, ex.
 * `/Drive/Pose` or its `/Drive/Pose/rotation` field, turns it so field +X points the same way it does there. Otherwise
 * field +X points up.
 */
function drivetrainRotation(
	heading: number,
	headingEntry: Entry | undefined,
	layout: PaneNode,
	mobile: boolean,
): number {
	const xAxisAngle = (headingEntry && fieldXAxisAngle(layout, headingEntry.name, mobile)) ?? Math.PI / 2;
	return heading + xAxisAngle - Math.PI / 2;
}

export function Swerve({ bindings, layout, options }: WidgetProps) {
	const time = useCursorTime();
	const mobile = useMobileLayout();
	const chassis = chassisHalf(useRobotDimensions(options['robot']!));
	const modulePositions = moduleCorners.map(([x, y]): Point => [
		x * (chassis[0] - moduleInset),
		y * (chassis[1] - moduleInset),
	]);
	// Values at the cursor and the arrow scale change as samples arrive
	useDataVersion();

	const valueOf = (entry: Entry | undefined) => (entry && time !== undefined ? entry.samples.valueAt(time) : undefined);
	// Hidden headings are skipped, so hiding the first heading uses the next one
	const headingBinding = bindings.find((binding) => !binding.hidden && swerveRole(binding) === 'heading');
	const headingEntry = headingBinding?.entry;
	const heading = headingRadians(valueOf(headingEntry), headingEntry);
	const rotation = drivetrainRotation(heading, headingEntry, layout, mobile);

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
				icon: headingIcon,
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
				modulePositions={modulePositions}
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
		<div {...stylex.props(styles.swerve)}>
			<Legend items={legend} />
			<svg
				{...stylex.props(styles.drawing)}
				viewBox={`${-viewHalf} ${-viewHalf} ${viewHalf * 2} ${viewHalf * 2}`}
				role="img"
				aria-label="Swerve drive"
			>
				{/* Counterclockwise turns are negative SVG rotations */}
				<g transform={`rotate(${(-rotation * 180) / Math.PI})`}>
					{/* The robot's front points up, so its length is the chassis's height */}
					<rect
						x={-chassis[1]}
						y={-chassis[0]}
						width={chassis[1] * 2}
						height={chassis[0] * 2}
						rx={0.04}
						fill="none"
						{...stylex.props(styles.chassis)}
						strokeWidth={strokeWidth}
					/>
					{/* Earlier entries draw on top of later ones */}
					{extraLayers.toReversed()}
					{modulePositions.map((position, index) => (
						<g key={moduleLabels[index]}>
							<Wheel position={position} angle={wheelAngles?.[index] ?? 0} />
							<ModuleLabel position={position} chassis={chassis} label={moduleLabels[index]!} rotation={rotation} />
						</g>
					))}
					{primaryArrows}
					{speedDrawings.toReversed()}
				</g>
			</svg>
		</div>
	);
}
