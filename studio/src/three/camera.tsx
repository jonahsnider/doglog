import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { type AnimationPlaybackControls, animate } from 'motion/react';
import { type ComponentRef, type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import { type Camera, Vector3 } from 'three';
import { easing, useMotionTransition } from '@/lib/motion';
import { isControls, turn, useShiftSpeedup } from '@/three/orbit';

/** Moves the camera of the scene it's in, see `CameraRig` */
export type Rig = {
	/** Go back to the default view, framing the robot from its front right */
	reset: () => void;
	/** Look at what the camera orbits around from a direction, ex. +Z for a top view, keeping the zoom */
	lookFrom: (direction: Vector3) => void;
	/** Orbit by radians, counterclockwise around the robot and up */
	orbit: (azimuth: number, elevation: number) => void;
	/** Zoom for a signed number of input seconds, positive to move closer */
	zoom: (seconds: number) => void;
	/** Pan for a signed number of input seconds along each screen axis, positive to move right or up */
	pan: (right: number, up: number) => void;
	/** Stop moving to a view, ex. when the user moves the camera themselves */
	stop: () => void;
	/**
	 * Keep the camera on a moving position, without turning it: each call moves it as far as `position` moved since
	 * the last. With `from`, the camera stays there instead, turned toward `position`. `undefined` stops following.
	 */
	follow?: (position: Vector3 | undefined, from?: Vector3) => void;
};

/** The default view's direction, as radians counterclockwise from the robot's front and above the floor: its front right, a little above it */
const resetView = { azimuth: -1.05, elevation: 0.72 };

/** What the camera looks at, a little above the floor where most of a robot is */
const center = new Vector3(0, 0, 0.3);
/** Width and height in meters fit in the view at the default zoom */
const framedMeters = 2.25;

/** Keep the orbit target within one default view span of the robot, regardless of zoom. */
function clampPan(target: Vector3, camera?: Camera) {
	const distance = target.distanceTo(center);
	if (distance <= framedMeters) {
		return;
	}
	const correction = target
		.clone()
		.sub(center)
		.multiplyScalar(framedMeters / distance - 1);
	target.add(correction);
	// After a drag, translate the camera too so clamping doesn't turn it or change its orbit radius.
	camera?.position.add(correction);
	camera?.updateMatrixWorld();
}

/**
 * How far the camera is from what it orbits around. The view has no perspective, so this only sets which depths are
 * drawn: the scene draws `cameraDistance` in front of and behind it. A short range keeps depth steps about a
 * micrometer, which robot models are offset by to draw flush CAD faces, see `prepare()`.
 */
export const cameraDistance = 10;
export const maxElevation = Math.PI / 2 - 1e-4;

type Orbit = { target: Vector3; azimuth: number; elevation: number; zoom: number };

const zoomOut = 4;
const zoomIn = 16;
/** The zoom factor and pan pixels per second of keyboard input */
const zoomSpeed = 3;
const panSpeed = 500;

/** The camera's zoom limits in a canvas of `size`, in pixels per meter */
function zoomLimits(size: { width: number; height: number }): { minZoom: number; maxZoom: number } {
	const fit = Math.min(size.width, size.height) / framedMeters;
	return { minZoom: fit / zoomOut, maxZoom: fit * zoomIn };
}

/**
 * Orbit controls the camera rig moves, which can't zoom too far out or in for the canvas's size, and zoom and pan faster
 * while Shift is held
 */
export function CameraControls() {
	const size = useThree((state) => state.size);
	const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
	useShiftSpeedup(controls);

	return (
		<OrbitControls
			ref={controls}
			makeDefault
			enableDamping={false}
			{...zoomLimits(size)}
			onChange={() => {
				const orbitControls = controls.current;
				if (orbitControls) {
					clampPan(orbitControls.target, orbitControls.object);
				}
			}}
		/>
	);
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
		zoom: (seconds) => {
			const orbit = current();
			const { minZoom, maxZoom } = zoomLimits(get().size);
			place({ ...orbit, zoom: Math.min(maxZoom, Math.max(minZoom, orbit.zoom * zoomSpeed ** seconds)) });
		},
		pan: (right, up) => {
			const { camera } = get();
			const orbit = current();
			const rightAxis = new Vector3().setFromMatrixColumn(camera.matrix, 0);
			const upAxis = new Vector3().setFromMatrixColumn(camera.matrix, 1);
			const scale = panSpeed / orbit.zoom;
			orbit.target.addScaledVector(rightAxis, right * scale).addScaledVector(upAxis, up * scale);
			clampPan(orbit.target);
			place(orbit);
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

	// Keep showing the same part of the scene when the widget is resized, before it's drawn at the new size
	const lastSize = useRef<number>(undefined);
	useFrame(({ camera, size }) => {
		const shortest = Math.min(size.width, size.height);
		if (lastSize.current !== undefined && lastSize.current > 0 && shortest > 0 && shortest !== lastSize.current) {
			camera.zoom *= shortest / lastSize.current;
			camera.updateProjectionMatrix();
		}
		lastSize.current = shortest;
	});

	return null;
}
