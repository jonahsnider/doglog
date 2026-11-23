import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { expect, test } from 'vite-plus/test';
import { estimateCamera } from '@/widgets/video/estimate-camera';

const width = 1600;
const height = 900;
const half = (6.5 * 0.0254) / 2;

function observation(camera: PerspectiveCamera, position: Vector3, yaw = 0) {
	const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), yaw);
	const corners = [
		new Vector3(0, -half, half),
		new Vector3(0, half, half),
		new Vector3(0, half, -half),
		new Vector3(0, -half, -half),
	].map((corner) => {
		const { x, y } = corner.applyQuaternion(rotation).add(position).project(camera);
		return { x: ((x + 1) * width) / 2, y: ((1 - y) * height) / 2 };
	});
	return { position, rotation, corners };
}

test('recovers position, aim, roll, and field of view from differently oriented tags', () => {
	const camera = new PerspectiveCamera(31, width / height);
	camera.position.set(7.2, 1.8, 2.4);
	camera.up.set(0, 0, 1);
	camera.lookAt(3, 3, 1.4);
	camera.rotateZ(0.21);
	camera.updateMatrixWorld();
	const match = estimateCamera(
		[
			observation(camera, new Vector3(2.1, 2.8, 1.4), 0.1),
			observation(camera, new Vector3(3.8, 3.8, 1.5), -0.8),
			observation(camera, new Vector3(3.1, 2.5, 0.9), 0.2),
		],
		width,
		height,
	);
	expect(match).toBeDefined();
	expect(new Vector3(...match!.position).distanceTo(camera.position)).toBeLessThan(0.01);
	expect(new Quaternion(...match!.quaternion).angleTo(camera.quaternion)).toBeLessThan(0.002);
	expect(match!.verticalFov).toBeCloseTo(camera.fov, 1);
	expect(match!.aspect).toBe(16 / 9);
});

test('does not invent a position when zoom and distance cannot be distinguished', () => {
	const camera = new PerspectiveCamera(35, width / height);
	camera.position.set(8, 3, 1.6);
	camera.up.set(0, 0, 1);
	camera.lookAt(4, 3, 1.6);
	camera.updateMatrixWorld();
	const first = observation(camera, new Vector3(4, 2.3, 1.4));
	const second = observation(camera, new Vector3(4, 3.8, 1.8));
	expect(estimateCamera([first], width, height)).toBeUndefined();
	expect(estimateCamera([first, second], width, height)).toBeUndefined();
});
