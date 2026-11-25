import type { Rig } from '@/three/camera';

/** Radians per second of keyboard orbiting */
const orbitSpeed = 1.5;

/** What each key does to a 3D scene's camera while held, by its lowercase name */
export const cameraKeys: Partial<Record<string, (rig: Rig, seconds: number, speed: number) => void>> = {
	arrowleft: (rig, seconds) => rig.orbit(-orbitSpeed * seconds, 0),
	arrowright: (rig, seconds) => rig.orbit(orbitSpeed * seconds, 0),
	arrowup: (rig, seconds) => rig.orbit(0, orbitSpeed * seconds),
	arrowdown: (rig, seconds) => rig.orbit(0, -orbitSpeed * seconds),
	w: (rig, seconds, speed) => rig.zoom(seconds * speed),
	s: (rig, seconds, speed) => rig.zoom(-seconds * speed),
	a: (rig, seconds, speed) => rig.pan(-seconds * speed, 0),
	d: (rig, seconds, speed) => rig.pan(seconds * speed, 0),
	q: (rig, seconds, speed) => rig.pan(0, -seconds * speed),
	e: (rig, seconds, speed) => rig.pan(0, seconds * speed),
};
