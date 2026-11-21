// Where the field widget's 3D camera can be, and how it aims at what the user points at, see `@/three/field-camera`
import type { RootState } from '@react-three/fiber';
import { type Camera, MathUtils, Mesh, type Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three';

/** The field's size in meters, from the origin along +X and +Y, and the direction the default view looks from */
export type FieldFraming = {
	readonly length: number;
	readonly width: number;
	/** Radians counterclockwise from +X, of the direction from the field's center to the camera */
	readonly azimuth: number;
};

/** Vertical field of view in degrees */
export const fieldOfView = 45;
/** The default view's angle above the floor */
export const resetElevation = 0.7;
/** The camera stays above what it orbits by this angle, which keeps it above the floor when that's the floor */
export const minElevation = 0.03;
/** The camera stays this many meters above the floor */
const minHeight = 0.05;
/** The closest the camera zooms to what's under the pointer, in meters */
export const minDistance = 0.1;
/** How far the camera can be from the field's center, as a multiple of the default view's distance */
export const zoomOut = 2;
/**
 * Pressing a key after this many milliseconds without starts a new gesture, which aims at the center of the view.
 * Aiming checks the field's every triangle, too slow to do for every step of a gesture.
 */
export const gestureGap = 150;
/** Room around the field in the default view, as a fraction of its size */
const framingMargin = 1.12;

const zAxis = new Vector3(0, 0, 1);
const floor = new Plane(zAxis, 0);
const raycaster = new Raycaster();
// Only the nearest hit is used, so the field's meshes stop at their first, see `FieldModel`
raycaster.firstHitOnly = true;
/** The center of the view, in normalized device coordinates */
export const viewCenter = new Vector2(0, 0);

/**
 * How far the default view is from the field's center, the closest the camera can be with the field's corners in a
 * canvas of `size`. With perspective, the field's near end takes more of the view than its far end.
 */
export function framingDistance(
	{ length, width, azimuth }: FieldFraming,
	size: { width: number; height: number },
): number {
	const halfHeight = Math.tan(MathUtils.degToRad(fieldOfView / 2)) / framingMargin;
	const halfWidth = halfHeight * (size.height > 0 ? size.width / size.height : 1);
	const center = new Vector3(length / 2, width / 2, 0);
	const direction = new Vector3(
		Math.cos(azimuth) * Math.cos(resetElevation),
		Math.sin(azimuth) * Math.cos(resetElevation),
		Math.sin(resetElevation),
	);
	const forward = direction.clone().negate();
	const right = new Vector3().crossVectors(forward, zAxis).normalize();
	const screenUp = new Vector3().crossVectors(right, forward);
	const corners = [
		[0, 0],
		[length, 0],
		[0, width],
		[length, width],
	].map(([x = 0, y = 0]) => new Vector3(x, y, 0));
	const fits = (distance: number) => {
		const camera = center.clone().addScaledVector(direction, distance);
		return corners.every((corner) => {
			const offset = corner.clone().sub(camera);
			const depth = offset.dot(forward);
			return (
				depth > 0 &&
				Math.abs(offset.dot(right)) <= depth * halfWidth &&
				Math.abs(offset.dot(screenUp)) <= depth * halfHeight
			);
		});
	};
	let near = 1;
	let far = 200;
	for (let step = 0; step < 30; step++) {
		const middle = (near + far) / 2;
		if (fits(middle)) {
			far = middle;
		} else {
			near = middle;
		}
	}
	return far;
}

/** Height of the tallest field elements, in meters, for the field's extent in `fieldDepth()` */
const fieldHeight = 2.5;

/** How far ahead of the camera, along its view direction, the field's farthest corner is */
function fieldDepth(camera: Camera, { length, width }: FieldFraming): number {
	const forward = camera.getWorldDirection(new Vector3());
	let depth = 0;
	for (const x of [0, length]) {
		for (const y of [0, width]) {
			for (const z of [0, fieldHeight]) {
				depth = Math.max(depth, new Vector3(x, y, z).sub(camera.position).dot(forward));
			}
		}
	}
	return depth;
}

/**
 * How far ahead of the camera, along its view direction, the first thing drawn at `pointer` (normalized device
 * coordinates) is, or the floor when nothing is. Never past the field's far side: the floor near the horizon, or the
 * sky, would put it so far that panning there would fling the camera.
 */
function depthAt(
	{ scene, camera }: Pick<RootState, 'scene' | 'camera'>,
	pointer: Vector2,
	field: FieldFraming,
): number {
	raycaster.setFromCamera(pointer, camera);
	// Hidden objects, like the staged game pieces, can still be hit, and lines are too thin to aim at
	const meshes: Object3D[] = [];
	scene.traverseVisible((object) => {
		if (object instanceof Mesh && !('isLineSegments2' in object)) {
			meshes.push(object);
		}
	});
	const hit = raycaster.intersectObjects(meshes, false)[0]?.point ?? raycaster.ray.intersectPlane(floor, new Vector3());
	const farthest = fieldDepth(camera, field);
	return Math.min(hit?.sub(camera.position).dot(camera.getWorldDirection(new Vector3())) ?? farthest, farthest);
}

/**
 * Moves the orbit target along the view's center line to the depth of what's at `pointer`, without moving or turning
 * the camera. Panning moves the camera relative to its distance to the target, and orbiting pivots around it, so they
 * then work at the scale of what the user points at.
 */
export function aim(
	state: Pick<RootState, 'scene' | 'camera'>,
	target: Vector3,
	pointer: Vector2,
	field: FieldFraming,
) {
	const { camera } = state;
	const depth = Math.max(depthAt(state, pointer, field), minDistance);
	target.copy(camera.position).addScaledVector(camera.getWorldDirection(new Vector3()), depth);
}

/**
 * Zooming moves the camera by a share of its distance to the orbit target. The target is put this far ahead, in
 * meters, when the camera is close to the field, so zooming there moves at one steady speed.
 */
const minZoomDistance = 4;

/**
 * Moves the orbit target along the view's center line, without moving the camera, so zooming moves at a speed set by
 * how far the camera is from the field: faster from far above or away, and steady near it. It doesn't depend on
 * what's under the pointer, so it doesn't change as the pointer moves over the field, or slow down near things.
 */
export function aimZoom(camera: Camera, target: Vector3, { length, width }: FieldFraming) {
	const { x, y, z } = camera.position;
	const distance = Math.hypot(Math.max(-x, 0, x - length), Math.max(-y, 0, y - width), z);
	target
		.copy(camera.position)
		.addScaledVector(camera.getWorldDirection(new Vector3()), Math.max(distance, minZoomDistance));
}

/** Keeps the camera above the floor and near the field, moving the orbit target with it so it doesn't turn */
export function keepInBounds(
	camera: Camera,
	target: Vector3,
	field: FieldFraming,
	size: { width: number; height: number },
) {
	const center = new Vector3(field.length / 2, field.width / 2, 0);
	const offset = camera.position.clone().sub(center);
	const maxDistance = framingDistance(field, size) * zoomOut;
	const correction = new Vector3();
	if (offset.length() > maxDistance) {
		correction.copy(offset).multiplyScalar(maxDistance / offset.length() - 1);
	}
	correction.z = Math.max(correction.z, minHeight - camera.position.z);
	if (correction.lengthSq() === 0) {
		return;
	}
	camera.position.add(correction);
	target.add(correction);
	camera.updateMatrixWorld();
}
