import { Edges } from '@react-three/drei';
import type { ReactNode } from 'react';
import { type BufferGeometry, ExtrudeGeometry, Path, Shape, ShapeGeometry, Vector2 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { defaultRobotDimensions, type RobotDimensions } from '@/three/project-schema';
import { useThemeColor } from '@/three/theme';

// A swerve drivebase in the style of KrayonCAD's swerve drive: a rounded bumper, box tube frame rails, a bellypan,
// and four modules with a drive and a steer motor each. Meters, +X front, +Y left, +Z up.

const bumperThickness = 0.085;
const bumperHeight = 0.127;
const bumperBottom = 0.03;
/** Radius of the bumper's rounded edges, like its pool noodles */
const bumperRound = 0.03;
/** 2x1 box tube, standing on its narrow side */
const tubeWidth = 0.0254;
const tubeHeight = 0.0508;
const frameBottom = 0.04;
const frameTop = frameBottom + tubeHeight;
const bellypanThickness = 0.005;
const moduleSize = 0.127;
const moduleThickness = 0.018;
const wheelRadius = 0.0508;
const wheelWidth = 0.038;
const driveMotor = { radius: 0.03, height: 0.06 };
const steerMotor = { radius: 0.021, height: 0.05, offset: 0.038 };

const colors = { frame: '#9b9b9b', bellypan: '#c8c8c8', module: '#7c7c7c', motor: '#505050', wheel: '#3a3a3a' };
const edgeColor = '#151515';

/** Half of a rectangle's length along X and width along Y */
type Half = readonly [x: number, y: number];

function roundedRect<T extends Path>(path: T, [halfX, halfY]: Half, radius: number): T {
	for (const [corner, [x, y]] of [
		[1, 1],
		[-1, 1],
		[-1, -1],
		[1, -1],
	].entries()) {
		path.absarc(
			x! * (halfX - radius),
			y! * (halfY - radius),
			radius,
			(corner * Math.PI) / 2,
			((corner + 1) * Math.PI) / 2,
		);
	}
	return path;
}

function bumperGeometry(half: Half, frameHalf: Half): BufferGeometry {
	const shape = roundedRect(new Shape(), half, 0.07);
	shape.holes.push(roundedRect(new Path(), frameHalf, 0.005));
	const geometry = new ExtrudeGeometry(shape, {
		depth: bumperHeight - bumperRound * 2,
		bevelThickness: bumperRound,
		bevelSize: bumperRound,
		// Keeps the bevel inside the outline instead of growing it
		bevelOffset: -bumperRound,
		bevelSegments: 6,
		curveSegments: 12,
	});
	geometry.translate(0, 0, bumperBottom + bumperRound);
	// Shared vertices get smooth normals, so the rounded edges are shaded smoothly instead of in facets
	geometry.deleteAttribute('uv');
	geometry.deleteAttribute('normal');
	const smooth = mergeVertices(geometry);
	smooth.computeVertexNormals();
	return smooth;
}

/** A flat arrow toward the robot's front, shaped like the swerve widget's arrows with rounded corners */
function arrowGeometry(): BufferGeometry {
	const [tail, neck, tip] = [-0.15, 0.03, 0.15];
	const [shaft, head] = [0.019, 0.072];
	const corners = [
		[tail, shaft],
		[neck, shaft],
		[neck, head],
		[tip, 0],
		[neck, -head],
		[neck, -shaft],
		[tail, -shaft],
	].map(([x = 0, y = 0]) => new Vector2(x, y));
	const shape = new Shape();
	for (const [index, corner] of corners.entries()) {
		// Cuts each corner from a point before it to a point after it, curving through it
		const before = corners
			.at(index - 1)!
			.clone()
			.sub(corner)
			.setLength(0.008)
			.add(corner);
		const after = corners[(index + 1) % corners.length]!.clone().sub(corner).setLength(0.008).add(corner);
		if (index === 0) {
			shape.moveTo(before.x, before.y);
		} else {
			shape.lineTo(before.x, before.y);
		}
		shape.quadraticCurveTo(corner.x, corner.y, after.x, after.y);
	}
	const geometry = new ShapeGeometry(shape, 6);
	// Just above the bellypan
	geometry.translate(0, 0, frameBottom + bellypanThickness + 0.002);
	return geometry;
}

const arrow = arrowGeometry();

type Drivebase = {
	readonly bumper: BufferGeometry;
	readonly rails: readonly { readonly position: Half; readonly size: Half }[];
	readonly bellypan: Half;
	/** Module centers, with their plates over the frame's corners */
	readonly moduleOffset: Half;
};

/** Drivebases by their dimensions, robots of the same size share geometry */
const drivebases = new Map<string, Drivebase>();

function drivebaseOf({ length, width }: RobotDimensions): Drivebase {
	const key = `${length}x${width}`;
	let drivebase = drivebases.get(key);
	if (drivebase === undefined) {
		// The frame's half length and width, inside the bumpers
		const x = length / 2 - bumperThickness;
		const y = width / 2 - bumperThickness;
		drivebase = {
			bumper: bumperGeometry([length / 2, width / 2], [x, y]),
			rails: [
				{ position: [x - tubeWidth / 2, 0], size: [tubeWidth, y * 2] },
				{ position: [-x + tubeWidth / 2, 0], size: [tubeWidth, y * 2] },
				{ position: [0, y - tubeWidth / 2], size: [x * 2 - tubeWidth * 2, tubeWidth] },
				{ position: [0, -y + tubeWidth / 2], size: [x * 2 - tubeWidth * 2, tubeWidth] },
			],
			bellypan: [(x - tubeWidth) * 2, (y - tubeWidth) * 2],
			moduleOffset: [x - moduleSize / 2, y - moduleSize / 2],
		};
		drivebases.set(key, drivebase);
	}
	return drivebase;
}

const corners = [
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1],
] as const;

function Part({
	color,
	geometry,
	position,
	rotation,
	scale,
	opacity,
}: {
	color: string;
	geometry: ReactNode;
	position?: [number, number, number];
	rotation?: [number, number, number];
	scale?: [number, number, number];
	opacity: number;
}) {
	return (
		<mesh position={position} rotation={rotation} scale={scale}>
			{geometry}
			<meshStandardMaterial color={color} {...seeThrough(opacity)} />
			<Edges color={edgeColor} threshold={30} {...seeThrough(opacity)} />
		</mesh>
	);
}

/** Material props for a see-through robot, which doesn't hide what's behind it */
function seeThrough(opacity: number) {
	return opacity < 1 ? { transparent: true, opacity, depthWrite: false } : {};
}

const box = <boxGeometry />;

/**
 * A swerve drivebase drawn without a model, `dimensions` with its bumpers in `color` or the theme's primary color.
 * Ghosts are drawn with an `opacity` below 1.
 */
export function SwerveDrivebase({
	color,
	opacity = 1,
	dimensions = defaultRobotDimensions,
}: {
	color?: string;
	opacity?: number;
	dimensions?: RobotDimensions;
}) {
	const primary = useThemeColor('var(--color-accent)');
	const bumperColor = color ?? primary;
	const { bumper, rails, bellypan, moduleOffset } = drivebaseOf(dimensions);
	return (
		<group>
			<mesh geometry={bumper}>
				<meshStandardMaterial color={bumperColor} {...seeThrough(opacity)} />
			</mesh>
			{rails.map(({ position: [x, y], size: [sx, sy] }) => (
				<Part
					key={`${x},${y}`}
					opacity={opacity}
					color={colors.frame}
					geometry={box}
					position={[x, y, frameBottom + tubeHeight / 2]}
					scale={[sx, sy, tubeHeight]}
				/>
			))}
			<Part
				opacity={opacity}
				color={colors.bellypan}
				geometry={box}
				position={[0, 0, frameBottom + bellypanThickness / 2]}
				scale={[...bellypan, bellypanThickness]}
			/>
			<mesh geometry={arrow}>
				<meshBasicMaterial color={edgeColor} {...seeThrough(opacity)} />
			</mesh>
			{corners.map(([sx, sy]) => (
				<group key={`${sx},${sy}`} position={[sx * moduleOffset[0], sy * moduleOffset[1], 0]}>
					{/* Cylinders are along Y, which is the wheel's axle when it points forward */}
					<Part
						opacity={opacity}
						color={colors.wheel}
						geometry={<cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 32]} />}
						position={[0, 0, wheelRadius]}
					/>
					<Part
						opacity={opacity}
						color={colors.module}
						geometry={box}
						position={[0, 0, frameTop + moduleThickness / 2]}
						scale={[moduleSize, moduleSize, moduleThickness]}
					/>
					{/* Motors stand up on the module, the steer motor toward the robot's center */}
					{[
						{ ...driveMotor, x: 0, y: 0 },
						{ ...steerMotor, x: -sx * steerMotor.offset, y: -sy * steerMotor.offset },
					].map(({ radius, height, x, y }) => (
						<Part
							key={radius}
							opacity={opacity}
							color={colors.motor}
							geometry={<cylinderGeometry args={[radius, radius, height, 32]} />}
							position={[x, y, frameTop + moduleThickness + height / 2]}
							rotation={[Math.PI / 2, 0, 0]}
						/>
					))}
				</group>
			))}
		</group>
	);
}
