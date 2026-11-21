// The field widget's 3D scene: the field's model, which poses are drawn on, see `@/three/field-drawings`
import { useGLTF, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useEffectEvent, useMemo } from 'react';
import { Material, type Mesh, Plane, Raycaster, SRGBColorSpace, Vector2, Vector3 } from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import { addAprilTags } from '@/three/apriltags';
import { isMesh } from '@/three/robot-loading';
import fieldImage from '@/widgets/field/2026-rebuilt.webp';
import fieldModel from '@/widgets/field/2026-rebuilt.glb?url';
import {
	type FieldCoordinates,
	type FieldPoint,
	fieldLength,
	fieldWidth,
	image,
	pixelsPerMeterX,
	pixelsPerMeterY,
	toBlueWall,
} from '@/widgets/field/geometry';

/** Name of the node in the field's model holding the game pieces staged at the start of a match */
const stagedGamePiecesNode = 'StagedGamePieces';

// Loads as soon as the field's 3D view is imported, which a field in 2D does in the background
useGLTF.preload(fieldModel, false, true);

/**
 * Finding what's under the pointer, ex. to zoom toward it, only tests the triangles near it instead of all of them.
 * Copies of the field share geometries, so each tree is built once.
 */
function accelerateRaycasts(mesh: Mesh): void {
	mesh.geometry.boundsTree ??= new MeshBVH(mesh.geometry);
	mesh.raycast = acceleratedRaycast;
}

export function FieldModel({ stagedGamePieces }: { stagedGamePieces: boolean }) {
	const { scene } = useGLTF(fieldModel, false, true);
	// Models can only be in one scene, each widget draws its own copy
	const model = useMemo(() => addAprilTags(scene.clone()), [scene]);
	const invalidate = useThree((state) => state.invalidate);
	useEffect(() => {
		// Stickers sit a fraction of a millimeter off the parts they're on, closer than the depth buffer can tell apart,
		// so they're drawn in front of them. Every copy shares these materials and sets the same values.
		model.traverse((object) => {
			if (!isMesh(object)) {
				return;
			}
			const { material } = object;
			if (material instanceof Material && material.userData['decal'] === true) {
				material.polygonOffset = true;
				material.polygonOffsetFactor = -1;
				material.polygonOffsetUnits = -4;
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

/** Reports the field position under the pointer, where its line of sight meets the floor, if it's on the field */
export function FloorPointer({
	coordinates,
	onMove,
}: {
	coordinates: FieldCoordinates;
	onMove: (point: FieldPoint | undefined) => void;
}) {
	const get = useThree((state) => state.get);
	const element = useThree((state) => {
		const connected: unknown = state.events.connected;
		return connected instanceof HTMLElement ? connected : state.gl.domElement;
	});
	// Converting between the coordinates and the blue wall's is the same both ways
	const report = useEffectEvent((hit: Vector3 | undefined) =>
		onMove(hit && toBlueWall({ x: hit.x, y: hit.y }, coordinates)),
	);
	useEffect(() => {
		const raycaster = new Raycaster();
		const floor = new Plane(new Vector3(0, 0, 1), 0);
		const move = (event: PointerEvent) => {
			const { left, top, width, height } = element.getBoundingClientRect();
			raycaster.setFromCamera(
				new Vector2(((event.clientX - left) / width) * 2 - 1, 1 - ((event.clientY - top) / height) * 2),
				get().camera,
			);
			const hit = raycaster.ray.intersectPlane(floor, new Vector3());
			const onField = hit !== null && hit.x >= 0 && hit.x <= fieldLength && hit.y >= 0 && hit.y <= fieldWidth;
			report(onField ? hit : undefined);
		};
		const leave = () => report(undefined);
		element.addEventListener('pointermove', move);
		element.addEventListener('pointerleave', leave);
		return () => {
			element.removeEventListener('pointermove', move);
			element.removeEventListener('pointerleave', leave);
		};
	}, [element, get]);
	return null;
}
