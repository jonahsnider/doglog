// Poses drawn on the field's 3D scene, see `@/three/field-poses`
import { Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { type ReactNode, useMemo } from 'react';
import { DoubleSide, SphereGeometry, Vector3 } from 'three';
import type { Mechanism } from '@/data/mechanism';
import type { Value } from '@/data/samples';
import {
	anchor,
	centerCoordinates,
	fieldPoseMatrix,
	floorOffset,
	identity,
	isPose,
	items,
	lifted,
} from '@/three/field-poses';
import { Mechanism3d, type MechanismPlane } from '@/three/mechanism-3d';
import { poseMatrix } from '@/three/poses';
import { useLoadedRobot } from '@/three/robot-loading';
import { ghostOpacity, RobotModel } from '@/three/robot-model';
import { useRobotProject } from '@/three/robot-projects';
import { SwerveDrivebase } from '@/three/swerve-drivebase';
import { useThemeColor } from '@/three/theme';
import { readShape } from '@/widgets/field/data';
import type { FieldCoordinates } from '@/widgets/field/geometry';
import { defaultRobot } from '@/widgets/field/robots';
import type { WidgetBinding } from '@/widgets/widget-type';

/** Points are spheres this many meters across */
const pointRadius = 0.05;
const headingLength = 0.3;
const lineWidth = 2.5;
/** Paths and connections are lines on their own, so they're drawn thicker than headings and outlines */
const wideLineWidth = 5;
const sphere = new SphereGeometry(pointRadius, 16, 12);

/** Where each point is drawn, with the end of its heading line if it's a pose */
function markers(value: Value): { center: Vector3; heading: Vector3 | undefined }[] {
	return items(value).map((item) => {
		const matrix = fieldPoseMatrix(item);
		return {
			center: new Vector3().setFromMatrixPosition(matrix),
			heading: isPose(item) ? new Vector3(headingLength, 0, 0).applyMatrix4(matrix) : undefined,
		};
	});
}

function Points({ value, color }: { value: Value; color: string }) {
	// Values only change when the cursor moves to another sample
	const points = useMemo(() => markers(value), [value]);
	return points.map(({ center, heading }, index) => (
		// oxlint-disable-next-line react/no-array-index-key -- Array items don't have IDs
		<group key={index}>
			<mesh geometry={sphere} position={center}>
				<meshStandardMaterial color={color} />
			</mesh>
			{heading && <Line points={[center, heading]} color={color} lineWidth={lineWidth} />}
			{center.z > pointRadius && (
				<Line
					points={[center, center.clone().setZ(floorOffset)]}
					color={color}
					lineWidth={1}
					transparent
					opacity={0.4}
				/>
			)}
		</group>
	));
}

function Path({ value, color }: { value: Value; color: string }) {
	const points = useMemo(
		() => items(value).map((item) => lifted(new Vector3().setFromMatrixPosition(fieldPoseMatrix(item)))),
		[value],
	);
	return points.length >= 2 ? <Line points={points} color={color} lineWidth={wideLineWidth} /> : null;
}

const ellipseSegments = 64;

function Shapes({ value, color }: { value: Value; color: string }) {
	return items(value).map((item, index) => {
		const { kind, center, xRadius, yRadius } = readShape(item);
		const outline =
			kind === 'rectangle'
				? [
						[xRadius, yRadius],
						[-xRadius, yRadius],
						[-xRadius, -yRadius],
						[xRadius, -yRadius],
						[xRadius, yRadius],
					]
				: Array.from({ length: ellipseSegments + 1 }, (_, step) => {
						const angle = (step / ellipseSegments) * 2 * Math.PI;
						return [Math.cos(angle) * xRadius, Math.sin(angle) * yRadius];
					});
		return (
			// oxlint-disable-next-line react/no-array-index-key -- Array items don't have IDs
			<group key={index} position={[center.x, center.y, floorOffset]} rotation={[0, 0, center.heading ?? 0]}>
				<Line points={outline.map(([x = 0, y = 0]) => [x, y, 0] as const)} color={color} lineWidth={lineWidth} />
				<mesh scale={[xRadius * 2, yRadius * 2, 1]}>
					{kind === 'rectangle' ? <planeGeometry /> : <circleGeometry args={[0.5, ellipseSegments]} />}
					<meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} side={DoubleSide} />
				</mesh>
			</group>
		);
	});
}

/** What's drawn on a robot: its Robot, the poses of its parts, and its mechanisms */
export type RobotDrawing = {
	name: string;
	parts: Value | undefined;
	mechanisms: readonly { id: string; mechanism: Mechanism; plane: MechanismPlane }[];
};

/** A robot or ghost as its Robot, the swerve drivebase until a project's robot loads or when it can't */
function Robot({
	value,
	color,
	ghost,
	robot: { name, parts, mechanisms },
}: {
	value: Value;
	color: string;
	ghost: boolean;
	robot: RobotDrawing;
}) {
	const project = useRobotProject(name === defaultRobot ? '' : name);
	const { state } = useLoadedRobot(name === defaultRobot ? undefined : (project ?? undefined));
	const poses = useMemo(() => (Array.isArray(parts) ? parts.map((pose) => poseMatrix(pose)) : []), [parts]);
	const opacity = ghost ? ghostOpacity : 1;
	return (
		<group matrix={fieldPoseMatrix(value)} matrixAutoUpdate={false}>
			{state?.status === 'loaded' ? (
				<RobotModel robot={state.robot} poses={poses} {...(ghost && { ghost: color })} />
			) : (
				<SwerveDrivebase color={color} opacity={opacity} />
			)}
			{mechanisms.map(({ id, mechanism, plane }) => (
				<Mechanism3d key={id} mechanism={mechanism} plane={plane} />
			))}
		</group>
	);
}

/** One binding's drawing, with lines to it from the bindings connected to it */
function FieldDrawing({
	binding,
	value,
	sources,
	cssColor,
	robot,
	onPoint,
}: {
	binding: WidgetBinding;
	value: Value;
	sources: readonly { binding: WidgetBinding; value: Value }[];
	cssColor: string;
	/** Set for robots and ghosts */
	robot?: RobotDrawing;
	/** The pointer moved over or off of the drawing, ex. to remove its binding by middle-clicking it */
	onPoint: (bindingId: string, pointed: boolean) => void;
}) {
	const color = useThemeColor(cssColor);
	const role = binding.role?.id;
	let drawing: ReactNode = null;
	if (robot) {
		drawing = (
			<group
				onPointerOver={(event: ThreeEvent<PointerEvent>) => {
					event.stopPropagation();
					onPoint(binding.id, true);
				}}
				onPointerOut={() => onPoint(binding.id, false)}
			>
				<Robot value={value} color={color} ghost={role === 'ghost'} robot={robot} />
			</group>
		);
	} else if (role === 'point' || role === 'points') {
		drawing = <Points value={value} color={color} />;
	} else if (role === 'path') {
		drawing = <Path value={value} color={color} />;
	} else if (role === 'shape') {
		drawing = <Shapes value={value} color={color} />;
	}
	const ends = items(value).map((item) => anchor(item, role));
	return (
		<>
			{drawing}
			{sources.map((source) => {
				const start = anchor(source.value, source.binding.role?.id);
				return ends.map((end, index) => (
					<Line
						// oxlint-disable-next-line react/no-array-index-key -- Array items don't have IDs
						key={`${source.binding.id}-${index}`}
						points={[start, end]}
						color={color}
						lineWidth={wideLineWidth}
					/>
				));
			})}
		</>
	);
}

export type FieldDrawingProps = Parameters<typeof FieldDrawing>[0];

/** Each binding's drawing, in the field `coordinates` poses are logged in */
export function FieldDrawings({
	coordinates,
	drawings,
}: {
	coordinates: FieldCoordinates;
	drawings: readonly FieldDrawingProps[];
}) {
	return (
		<group matrix={coordinates === 'center' ? centerCoordinates : identity} matrixAutoUpdate={false}>
			{drawings.map((drawing) => (
				<FieldDrawing key={drawing.binding.id} {...drawing} />
			))}
		</group>
	);
}
