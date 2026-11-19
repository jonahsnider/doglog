import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { type AnimationPlaybackControls, animate } from 'motion/react';
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import { MOUSE, Vector3 } from 'three';
import { easing, useMotionTransition } from '@/lib/motion';

/** Moves the camera of the scene it's in, see `CameraRig` */
export type Rig = {
	/** Go back to the default view, framing the robot from its front right */
	reset: () => void;
	/** Look at what the camera orbits around from a direction, ex. +Z for a top view, keeping the zoom */
	lookFrom: (direction: Vector3) => void;
	/** Orbit by radians, counterclockwise around the robot and up */
	orbit: (azimuth: number, elevation: number) => void;
	zoom: (factor: number) => void;
	/** Pan by pixels, right and up on screen */
	pan: (right: number, up: number) => void;
	/** Stop moving to a view, ex. when the user moves the camera themselves */
	stop: () => void;
};

/** The default view's direction, as radians counterclockwise from the robot's front and above the floor: its front right, a little above it */
const resetView = { azimuth: -1.05, elevation: 0.72 };

/** What the camera looks at, a little above the floor where most of a robot is */
const center = new Vector3(0, 0, 0.3);
/** Width and height in meters fit in the view at the default zoom */
const framedMeters = 2.25;
export const cameraDistance = 20;
const maxElevation = Math.PI / 2 - 1e-4;

type Orbit = { target: Vector3; azimuth: number; elevation: number; zoom: number };

/** The parts of drei's orbit controls the camera rig moves */
type Controls = { target: Vector3; update: () => void };

function isControls(value: unknown): value is Controls {
	return typeof value === 'object' && value !== null && 'target' in value && 'update' in value;
}

const zoomOut = 4;
const zoomIn = 16;

/** The camera's zoom limits in a canvas of `size`, in pixels per meter */
function zoomLimits(size: { width: number; height: number }): { minZoom: number; maxZoom: number } {
	const fit = Math.min(size.width, size.height) / framedMeters;
	return { minZoom: fit / zoomOut, maxZoom: fit * zoomIn };
}

/** The angle from `from` to `to` the short way around */
function turn(from: number, to: number): number {
	return ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

type SpeedControls = {
	zoomSpeed: number;
	panSpeed: number;
	mouseButtons: { RIGHT?: MOUSE };
	dollyIn: () => void;
	dollyOut: () => void;
};

/** How many times as fast the camera zooms and pans while Shift is held */
export const shiftSpeedup = 2;

/**
 * Orbit controls the camera rig moves, which can't zoom too far out or in for the canvas's size, and zoom and pan faster
 * while Shift is held
 */
export function CameraControls() {
	const size = useThree((state) => state.size);
	// Where drei's orbit controls listen for input
	const element = useThree((state) => {
		const connected: unknown = state.events.connected;
		return connected instanceof HTMLElement ? connected : state.gl.domElement;
	});
	const controls = useRef<SpeedControls>(null);

	useEffect(() => {
		// Runs before the controls handle the event, which they listen for without capturing
		const onInput = (event: PointerEvent | WheelEvent) => {
			const orbitControls = controls.current;
			if (!orbitControls) {
				return;
			}
			const speed = event.shiftKey ? shiftSpeedup : 1;
			orbitControls.zoomSpeed = speed;
			orbitControls.panSpeed = speed;
			// The controls swap orbiting and panning while Shift is held, so the right button orbits to keep panning
			if (event.type === 'pointerdown') {
				orbitControls.mouseButtons.RIGHT = event.shiftKey ? MOUSE.ROTATE : MOUSE.PAN;
			}
			// Browsers scroll mouse wheels sideways while Shift is held, which the controls don't zoom with
			if (event instanceof WheelEvent && event.shiftKey && event.deltaY === 0 && event.deltaX !== 0) {
				event.preventDefault();
				if (event.deltaX < 0) {
					orbitControls.dollyIn();
				} else {
					orbitControls.dollyOut();
				}
			}
		};
		element.addEventListener('pointerdown', onInput, { capture: true });
		element.addEventListener('pointermove', onInput, { capture: true });
		element.addEventListener('wheel', onInput, { capture: true, passive: false });
		return () => {
			element.removeEventListener('pointerdown', onInput, { capture: true });
			element.removeEventListener('pointermove', onInput, { capture: true });
			element.removeEventListener('wheel', onInput, { capture: true });
		};
	}, [element]);

	return <OrbitControls ref={controls} makeDefault enableDamping={false} {...zoomLimits(size)} />;
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

	const resetOrbit = (): Orbit => {
		const { size } = get();
		return { target: center.clone(), ...resetView, zoom: Math.min(size.width, size.height) / framedMeters };
	};

	const animateTo = (to: Orbit) => {
		stop();
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
		reset: () => animateTo(resetOrbit()),
		lookFrom: (direction) => {
			const horizontal = Math.hypot(direction.x, direction.y);
			animateTo({
				...current(),
				// Straight above or below has no direction. The top view has the robot's front down on screen
				// and the bottom view has it up.
				azimuth: horizontal < 1e-6 ? (direction.z > 0 ? 0 : Math.PI) : Math.atan2(direction.y, direction.x),
				elevation: Math.max(-maxElevation, Math.min(maxElevation, Math.atan2(direction.z, horizontal))),
			});
		},
		stop,
		orbit: (azimuth, elevation) => {
			const orbit = current();
			place({
				...orbit,
				azimuth: orbit.azimuth + azimuth,
				elevation: Math.min(maxElevation, Math.max(-maxElevation, orbit.elevation + elevation)),
			});
		},
		zoom: (factor) => {
			const orbit = current();
			const { minZoom, maxZoom } = zoomLimits(get().size);
			place({ ...orbit, zoom: Math.min(maxZoom, Math.max(minZoom, orbit.zoom * factor)) });
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
			place(resetOrbit());
		}
	});
	useEffect(() => () => moving.current?.stop(), []);

	// Keep showing the same part of the scene when the widget is resized
	const size = useThree((state) => state.size);
	const lastSize = useRef<number>(undefined);
	useEffect(() => {
		const shortest = Math.min(size.width, size.height);
		if (lastSize.current !== undefined && lastSize.current > 0 && shortest > 0) {
			const { camera, invalidate } = get();
			camera.zoom *= shortest / lastSize.current;
			camera.updateProjectionMatrix();
			invalidate();
		}
		lastSize.current = shortest;
	}, [size, get]);

	return null;
}
