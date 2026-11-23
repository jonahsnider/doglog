import { levenbergMarquardt } from 'ml-levenberg-marquardt';
import { Matrix, solve } from 'ml-matrix';
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import { tagSize } from '@/three/apriltag-patterns';
import type { CameraMatch } from '@/widgets/field/camera-match';

type Pixel = { x: number; y: number };
export type TagObservation = {
	position: Vector3;
	rotation: Quaternion;
	/** Black border corners in the order top left, top right, bottom right, bottom left, in the tag's own orientation */
	corners: readonly Pixel[];
};

const half = tagSize / 2;
const tagCorners = [
	[-half, half],
	[half, half],
	[half, -half],
	[-half, -half],
] as const;

/** A starting pose from a single square's homography at an approximate focal length. */
function initialPose(tag: TagObservation, pixels: readonly Pixel[], focal: number) {
	const rows = [];
	const values = [];
	for (const [i, [right, up]] of tagCorners.entries()) {
		const { x, y } = pixels[i]!;
		const u = x / focal;
		const v = y / focal;
		rows.push([right, up, 1, 0, 0, 0, -u * right, -u * up], [0, 0, 0, right, up, 1, -v * right, -v * up]);
		values.push(u, v);
	}
	const h = solve(new Matrix(rows), Matrix.columnVector(values), true).to1DArray();
	const right = new Vector3(h[0], h[3], -h[6]!);
	const up = new Vector3(h[1], h[4], -h[7]!);
	const scale = 2 / (right.length() + up.length());
	right.normalize();
	const normal = new Vector3().crossVectors(right, up).normalize();
	up.crossVectors(normal, right);
	// In the field model, +X points out of the tag, +Y is right, and +Z is up.
	const cameraFromTag = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(normal, right, up));
	const rotation = tag.rotation.clone().multiply(cameraFromTag.invert());
	const position = tag.position
		.clone()
		.sub(new Vector3(h[2], h[5], -1).multiplyScalar(scale).applyQuaternion(rotation));
	return { position, rotation };
}

const diagonal = (corners: readonly Pixel[]) =>
	Math.hypot(corners[0]!.x - corners[2]!.x, corners[0]!.y - corners[2]!.y);

/** Fits a centered, square-pixel pinhole camera to the field's known 3D corners. Positions are in meters. */
export function estimateCamera(
	tags: readonly TagObservation[],
	width: number,
	height: number,
): CameraMatch | undefined {
	if (tags.length < 2) {
		return undefined;
	}
	const observed = tags.map(({ corners }) => corners.map(({ x, y }) => ({ x: x - width / 2, y: height / 2 - y })));
	const world = tags.flatMap(({ position, rotation }) =>
		tagCorners.map(([right, up]) => new Vector3(0, right, up).applyQuaternion(rotation).add(position)),
	);
	const coordinates = observed.flatMap((corners) => corners.flatMap(({ x, y }) => [x, y]));
	const data = { x: coordinates.map((_, i) => i), y: coordinates };
	// Use the largest tag to initialize; it has the least relative error in its corners.
	const anchor = observed.reduce((best, corners, i) => (diagonal(corners) > diagonal(observed[best]!) ? i : best), 0);
	const minFocal = 0.25;
	const maxFocal = 5;
	const fit = (guess: number, fixed?: { position: Vector3; rotation: Quaternion }) => {
		const seed = fixed ?? initialPose(tags[anchor]!, observed[anchor]!, guess * width);
		const pose = ([x, y, z, roll, pitch, yaw]: number[]) => ({
			position: seed.position.clone().add(new Vector3(x, y, z)),
			rotation: seed.rotation.clone().multiply(new Quaternion().setFromEuler(new Euler(roll, pitch, yaw))),
		});
		const { parameterValues, parameterError } = levenbergMarquardt(
			data,
			(parameters) => {
				const { position, rotation } = pose(parameters);
				const view = rotation.invert();
				const focal = (parameters[6] ?? guess) * width;
				const projection = world.flatMap((point) => {
					const camera = point.clone().sub(position).applyQuaternion(view);
					const scale = focal / Math.max(-camera.z, 0.01);
					return [camera.x * scale, camera.y * scale];
				});
				return (i) => projection[i]!;
			},
			{
				initialValues: fixed ? [0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, guess],
				minValues: [...Array.from({ length: 6 }, () => -Infinity), minFocal],
				maxValues: [...Array.from({ length: 6 }, () => Infinity), maxFocal],
				gradientDifference: 1e-5,
				maxIterations: 60,
				errorTolerance: 1e-6,
			},
		);
		return {
			...pose(parameterValues),
			focal: parameterValues[6] ?? guess,
			error: Math.sqrt(parameterError / world.length),
		};
	};

	const match = [0.55, 1, 1.8]
		.map((focal) => fit(focal))
		.filter(({ error, position, rotation, focal }) => {
			const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);
			return (
				error <= Math.max(2, width * 0.002) &&
				focal > minFocal &&
				focal < maxFocal &&
				world.every((point) => point.clone().sub(position).dot(forward) > 0) &&
				tags.every(
					(tag) =>
						position
							.clone()
							.sub(tag.position)
							.dot(new Vector3(1, 0, 0).applyQuaternion(tag.rotation)) > 0,
				)
			);
		})
		.toSorted((a, b) => a.error - b.error)[0];
	if (!match) {
		return undefined;
	}
	// A straight-on view of a flat wall can fit just as well from farther away with a longer lens. Reject it instead of
	// pretending to know the camera's position when a materially different focal length fits within corner-detection error.
	if ([match.focal / 1.25, match.focal * 1.25].some((focal) => fit(focal, match).error < match.error + 0.5)) {
		return undefined;
	}
	return {
		position: match.position.toArray(),
		quaternion: match.rotation.toArray(),
		verticalFov: MathUtils.radToDeg(2 * Math.atan(height / (2 * match.focal * width))),
		aspect: width / height,
	};
}
