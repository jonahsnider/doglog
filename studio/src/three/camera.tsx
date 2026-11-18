import { useThree } from '@react-three/fiber';
import { type AnimationPlaybackControls, animate } from 'motion/react';
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import { Vector3 } from 'three';
import { easing, useMotionTransition } from '@/lib/motion';

export type CameraView = 'reset' | 'top' | 'front' | 'side';

/** Moves the camera of a `Scene3d` */
export type Scene3dHandle = { setView: (view: CameraView) => void };

/** Moves the camera of the scene it's in, see `CameraRig` */
export type Rig = Scene3dHandle & {
	/** Orbit by radians, counterclockwise around the robot and up */
	orbit: (azimuth: number, elevation: number) => void;
	zoom: (factor: number) => void;
	/** Pan by pixels, right and up on screen */
	pan: (right: number, up: number) => void;
	/** Stop moving to a view, ex. when the user moves the camera themselves */
	stop: () => void;
};

/** Directions to look from, as radians counterclockwise from the robot's front and above the floor */
const views: Record<CameraView, { azimuth: number; elevation: number }> = {
	// The robot's front right, a little above it
	reset: { azimuth: -1.05, elevation: 0.72 },
	// From behind, so the robot's front is up on screen. Not quite overhead, which has no "up".
	top: { azimuth: Math.PI, elevation: Math.PI / 2 - 1e-4 },
	front: { azimuth: 0, elevation: 0 },
	side: { azimuth: -Math.PI / 2, elevation: 0 },
};

/** What the camera looks at, a little above the floor where most of a robot is */
const center = new Vector3(0, 0, 0.3);
/** Width and height in meters fit in the view at the default zoom */
const framedMeters = 3;
export const cameraDistance = 20;
const maxElevation = Math.PI / 2 - 1e-4;

/** Where the camera is, as what it orbits around, its direction from there, and its zoom */
type Orbit = { target: Vector3; azimuth: number; elevation: number; zoom: number };

/** The parts of drei's orbit controls the camera rig moves */
type Controls = { target: Vector3; update: () => void };

function isControls(value: unknown): value is Controls {
	return typeof value === 'object' && value !== null && 'target' in value && 'update' in value;
}

/** The angle from `from` to `to` the short way around */
function turn(from: number, to: number): number {
	return ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

/** Moves the camera around the robot, and to views of it. Render it inside the scene's canvas. */
export function CameraRig({ ref }: { ref: Ref<Rig> }) {
	// three.js objects are changed in place, outside of React's state
	const get = useThree((state) => state.get);
	const controls = useThree((state) => state.controls);
	const transition = useMotionTransition({ duration: 0.3, ease: easing.inOut });
	const moving = useRef<AnimationPlaybackControls>(undefined);

	const current = (): Orbit => {
		const { camera, controls: orbitControls } = get();
		const target = isControls(orbitControls) ? orbitControls.target.clone() : center.clone();
		const offset = new Vector3().subVectors(camera.position, target);
		return {
			target,
			azimuth: Math.atan2(offset.y, offset.x),
			elevation: Math.asin(Math.min(1, Math.max(-1, offset.z / offset.length()))),
			zoom: camera.zoom,
		};
	};

	const place = ({ target, azimuth, elevation, zoom }: Orbit) => {
		const { camera, controls: orbitControls, invalidate } = get();
		const flat = Math.cos(elevation) * cameraDistance;
		camera.position.set(
			target.x + Math.cos(azimuth) * flat,
			target.y + Math.sin(azimuth) * flat,
			target.z + Math.sin(elevation) * cameraDistance,
		);
		camera.zoom = zoom;
		camera.updateProjectionMatrix();
		camera.lookAt(target);
		if (isControls(orbitControls)) {
			orbitControls.target.copy(target);
			orbitControls.update();
		}
		invalidate();
	};

	const stop = () => {
		moving.current?.stop();
		moving.current = undefined;
	};

	const orbitOf = (view: CameraView): Orbit => {
		const { size } = get();
		return { target: center.clone(), ...views[view], zoom: Math.min(size.width, size.height) / framedMeters };
	};

	const setView = (view: CameraView) => {
		stop();
		const to = orbitOf(view);
		const from = current();
		const azimuth = turn(from.azimuth, to.azimuth);
		moving.current = animate(0, 1, {
			...transition,
			onUpdate: (progress) =>
				place({
					target: from.target.clone().lerp(to.target, progress),
					azimuth: from.azimuth + azimuth * progress,
					elevation: from.elevation + (to.elevation - from.elevation) * progress,
					// Zooming by the same factor each moment looks steady
					zoom: from.zoom * (to.zoom / from.zoom) ** progress,
				}),
		});
	};

	useImperativeHandle(ref, () => ({
		setView,
		stop,
		orbit: (azimuth, elevation) => {
			const orbit = current();
			place({
				...orbit,
				azimuth: orbit.azimuth + azimuth,
				elevation: Math.min(maxElevation, Math.max(0, orbit.elevation + elevation)),
			});
		},
		zoom: (factor) => {
			const orbit = current();
			place({ ...orbit, zoom: orbit.zoom * factor });
		},
		pan: (right, up) => {
			const { camera } = get();
			const orbit = current();
			const rightAxis = new Vector3().setFromMatrixColumn(camera.matrix, 0);
			const upAxis = new Vector3().setFromMatrixColumn(camera.matrix, 1);
			place({
				...orbit,
				target: orbit.target.addScaledVector(rightAxis, right / orbit.zoom).addScaledVector(upAxis, up / orbit.zoom),
			});
		},
	}));

	// Frame the robot once the controls exist, they move the camera when they're created
	const framed = useRef(false);
	useEffect(() => {
		if (controls && !framed.current) {
			framed.current = true;
			place(orbitOf('reset'));
		}
	});
	useEffect(() => () => moving.current?.stop(), []);

	return null;
}
