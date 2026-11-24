// The field widget's 3D scene: the field's model, which poses are drawn on, see `@/three/field-drawings`
import { Line, useTexture } from '@react-three/drei';
import { useLoader, useThree } from '@react-three/fiber';
import { type Ref, useEffect, useEffectEvent, useImperativeHandle, useMemo } from 'react';
import { Material, type Mesh, Plane, Raycaster, SRGBColorSpace, Vector2, Vector3 } from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import { addAprilTags } from '@/three/apriltags';
import { floorOffset } from '@/three/field-poses';
import { gltfLoader } from '@/three/gltf-loader';
import { isMesh } from '@/three/robot-loading';
import fieldImage from '@/widgets/field/2026-rebuilt.webp';
import fieldModel from '@/widgets/field/2026-rebuilt.glb?url';
import type { DrawPointAt } from '@/widgets/field/draw';
import {
	type FieldPoint,
	fieldLength,
	fieldWidth,
	image,
	pixelsPerMeterX,
	pixelsPerMeterY,
} from '@/widgets/field/geometry';

/** Name of the node in the field's model holding the game pieces staged at the start of a match */
const stagedGamePiecesNode = 'StagedGamePieces';
/** Name of the node in the field's model holding its perimeter: the guardrails and alliance walls */
const fieldBorderNode = 'FieldBorder';
/**
 * Opacity of the clear acrylic at the driver stations and human player outposts, so the field can be seen through it.
 */
const glassOpacity = 0.08;
/** Opacity of the perimeter's other parts when it's see-through, and of its plastic */
const seeThroughOpacity = 0.12;
const seeThroughGlassOpacity = 0.03;

// Loads as soon as the field's 3D view is imported, which a field in 2D does in the background
useLoader.preload(gltfLoader, fieldModel);

/**
 * Finding what's under the pointer, ex. to zoom toward it, only tests the triangles near it instead of all of them.
 * Copies of the field share geometries, so each tree is built once.
 */
function accelerateRaycasts(mesh: Mesh): void {
	mesh.geometry.boundsTree ??= new MeshBVH(mesh.geometry);
	mesh.raycast = acceleratedRaycast;
}

export function FieldModel({
	stagedGamePieces,
	seeThroughBorder,
}: {
	stagedGamePieces: boolean;
	seeThroughBorder: boolean;
}) {
	const { scene } = useLoader(gltfLoader, fieldModel);
	// Models can only be in one scene, each widget draws its own copy
	const model = useMemo(() => {
		const copy = addAprilTags(scene.clone());
		// Each copy's perimeter has its own materials, since each widget can make it see-through
		copy.getObjectByName(fieldBorderNode)?.traverse((object) => {
			if (isMesh(object) && object.material instanceof Material) {
				object.material = object.material.clone();
				object.material.userData['glass'] = object.material.transparent;
			}
		});
		return copy;
	}, [scene]);
	const invalidate = useThree((state) => state.invalidate);
	useEffect(() => {
		// Stickers sit a fraction of a millimeter off the parts they're on, closer than the depth buffer can tell apart,
		// so they're drawn in front of them. Every copy shares these materials and sets the same values.
		model.traverse((object) => {
			if (!isMesh(object)) {
				return;
			}
			const { material } = object;
			if (material instanceof Material) {
				if (material.userData['decal'] === true) {
					material.polygonOffset = true;
					material.polygonOffsetFactor = -1;
					material.polygonOffsetUnits = -4;
				}
				// The outpost exchange acrylic sits outside FieldBorder and stays clear in either border mode.
				if (object.name.startsWith('GE-26010_') && material.transparent) {
					material.opacity = glassOpacity;
				}
			}
			accelerateRaycasts(object);
		});
		invalidate();
	}, [model, invalidate]);
	useEffect(() => {
		const staged = model.getObjectByName(stagedGamePiecesNode);
		if (staged) {
			staged.visible = stagedGamePieces;
			invalidate();
		}
	}, [model, stagedGamePieces, invalidate]);
	useEffect(() => {
		model.getObjectByName(fieldBorderNode)?.traverse((object) => {
			if (!isMesh(object) || !(object.material instanceof Material)) {
				return;
			}
			const { material } = object;
			const glass = material.userData['glass'] === true;
			if (seeThroughBorder) {
				material.opacity = glass ? seeThroughGlassOpacity : seeThroughOpacity;
			} else {
				material.opacity = glass ? glassOpacity : 1;
			}
			material.transparent = material.opacity < 1;
			// Parts behind see-through ones are still drawn
			material.depthWrite = !material.transparent;
			material.needsUpdate = true;
		});
		invalidate();
	}, [model, seeThroughBorder, invalidate]);
	return <primitive object={model} />;
}

/** The 2D field's top-down render on the floor, shown while the model loads */
export function FieldImageFloor() {
	const texture = useTexture(fieldImage, (loaded) => {
		loaded.colorSpace = SRGBColorSpace;
	});
	// The image has red on the left, so it's turned a half turn, with its field boundary on the field's
	const width = image.width / pixelsPerMeterX;
	const height = image.height / pixelsPerMeterY;
	return (
		<mesh
			position={[
				fieldLength - (image.width / 2 - image.left) / pixelsPerMeterX,
				(image.height / 2 - image.top) / pixelsPerMeterY,
				0,
			]}
			rotation={[0, 0, Math.PI]}
		>
			<planeGeometry args={[width, height]} />
			<meshBasicMaterial map={texture} transparent alphaTest={0.05} />
		</mesh>
	);
}

/** A temporary freehand stroke on the carpet, in blue-wall coordinates. */
export function FloorSketch({ points }: { points: readonly FieldPoint[] }) {
	const line = useMemo(() => points.map(({ x, y }) => [x, y, floorOffset] as const), [points]);
	return line.length > 1 ? (
		<>
			<Line points={line} color="black" lineWidth={6} depthWrite={false} />
			<Line points={line} color="white" lineWidth={3} renderOrder={1} />
		</>
	) : null;
}

export type FloorProjection = () => DrawPointAt;

/** Reports the field position under the pointer, where its line of sight meets the floor, if it's on the field */
export function FloorPointer({
	ref,
	onMove,
}: {
	ref: Ref<FloorProjection>;
	onMove: (point: FieldPoint | undefined) => void;
}) {
	const get = useThree((state) => state.get);
	const element = useThree((state) => {
		const connected: unknown = state.events.connected;
		return connected instanceof HTMLElement ? connected : state.gl.domElement;
	});
	const project = useMemo<FloorProjection>(() => {
		const raycaster = new Raycaster();
		const floor = new Plane(new Vector3(0, 0, 1), 0);
		const ndc = new Vector2();
		const position = new Vector3();
		return () => {
			const { left, top, width, height } = element.getBoundingClientRect();
			const { camera } = get();
			return ({ clientX, clientY }) => {
				raycaster.setFromCamera(
					ndc.set(((clientX - left) / width) * 2 - 1, 1 - ((clientY - top) / height) * 2),
					camera,
				);
				const hit = raycaster.ray.intersectPlane(floor, position);
				const onField = hit !== null && hit.x >= 0 && hit.x <= fieldLength && hit.y >= 0 && hit.y <= fieldWidth;
				return onField ? { x: hit.x, y: hit.y } : undefined;
			};
		};
	}, [element, get]);
	useImperativeHandle(ref, () => project, [project]);
	const report = useEffectEvent(onMove);
	useEffect(() => {
		const move = (event: PointerEvent) => report(project()(event));
		const leave = () => report(undefined);
		element.addEventListener('pointermove', move);
		element.addEventListener('pointerleave', leave);
		return () => {
			element.removeEventListener('pointermove', move);
			element.removeEventListener('pointerleave', leave);
		};
	}, [element, project]);
	return null;
}
