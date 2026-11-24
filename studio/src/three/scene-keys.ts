import type { Rig } from '@/three/camera';

/** Radians per second of keyboard orbiting */
const orbitSpeed = 1.5;
type CameraActions = Partial<Record<string, (rig: Rig, seconds: number, speed: number) => void>>;
const commonKeys: CameraActions = {
	arrowleft: (rig, seconds) => rig.orbit(-orbitSpeed * seconds, 0),
	arrowright: (rig, seconds) => rig.orbit(orbitSpeed * seconds, 0),
	arrowup: (rig, seconds) => rig.orbit(0, orbitSpeed * seconds),
	arrowdown: (rig, seconds) => rig.orbit(0, -orbitSpeed * seconds),
	w: (rig, seconds, speed) => rig.zoom(seconds * speed),
	s: (rig, seconds, speed) => rig.zoom(-seconds * speed),
	a: (rig, seconds, speed) => rig.pan(-seconds * speed, 0),
	q: (rig, seconds, speed) => rig.pan(0, -seconds * speed),
	e: (rig, seconds, speed) => rig.pan(0, seconds * speed),
};

function cameraKeys(panRight: 'D' | 'F') {
	const actions: CameraActions = {
		...commonKeys,
		[panRight.toLowerCase()]: (rig, seconds, speed) => rig.pan(seconds * speed, 0),
	};
	return { panRight, actions };
}

export const sceneKeys = {
	robot: cameraKeys('D'),
	// The field reserves D for Draw, including when its camera controls are focused.
	field: cameraKeys('F'),
};
