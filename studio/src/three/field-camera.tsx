// The field widget's 3D camera: perspective, moving relative to what the user points at, and kept above the carpet and
// near the field
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { type AnimationPlaybackControls, animate } from 'motion/react';
import { type ComponentRef, type Ref, useEffect, useEffectEvent, useImperativeHandle, useRef } from 'react';
import { MathUtils, Vector2, Vector3 } from 'three';
import { easing, useMotionTransition } from '@/lib/motion';
import { maxElevation, type Rig } from '@/three/camera';
import {
	aim,
	aimZoom,
	type FieldFraming,
	framingDistance,
	gestureGap,
	keepInBounds,
	minDistance,
	minElevation,
	resetElevation,
	viewCenter,
	zoomOut,
} from '@/three/field-framing';
import { isControls, turn, useShiftSpeedup } from '@/three/orbit';

/** How many times as fast mouse zooming and panning are as in the robot widget, since the field is much bigger */
const fieldSpeed = 2;
/** Meters per second of keyboard movement */
const keyboardMoveSpeed = 8;

type Orbit = { target: Vector3; azimuth: number; elevation: number; distance: number };

/** The controls pan with the right button, or the left with a modifier, and swap them while Shift is held */
function pans(event: PointerEvent): boolean {
	return (
		(event.button === 0 && (event.shiftKey || event.ctrlKey || event.metaKey)) ||
		(event.button === 2 && !event.shiftKey)
	);
}

/** Orbit controls for the field, which move relative to what the user points at, see `aim()` */
export function FieldCameraControls({ field, following }: { field: FieldFraming; following: boolean }) {
	const get = useThree((state) => state.get);
	const size = useThree((state) => state.size);
	// Where drei's orbit controls listen for input
	const element = useThree((state) => {
		const connected: unknown = state.events.connected;
		return connected instanceof HTMLElement ? connected : state.gl.domElement;
	});
	const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
	useShiftSpeedup(controls, fieldSpeed);

	useEffect(() => {
		// Runs before the controls handle the event, which they listen for without capturing
		const onInput = (event: PointerEvent | WheelEvent) => {
			const orbitControls = controls.current;
			if (!orbitControls) {
				return;
			}
			// While following a robot, the camera orbits and zooms around it
			if (following && !(event instanceof PointerEvent && pans(event))) {
				return;
			}
			if (event instanceof WheelEvent) {
				aimZoom(orbitControls.object, orbitControls.target, field);
			} else {
				const { left, top, width, height } = element.getBoundingClientRect();
				const pointer = new Vector2(((event.clientX - left) / width) * 2 - 1, 1 - ((event.clientY - top) / height) * 2);
				aim(get(), orbitControls.target, pans(event) ? pointer : viewCenter, field);
			}
			orbitControls.update();
		};
		element.addEventListener('pointerdown', onInput, { capture: true });
		element.addEventListener('wheel', onInput, { capture: true });
		return () => {
			element.removeEventListener('pointerdown', onInput, { capture: true });
			element.removeEventListener('wheel', onInput, { capture: true });
		};
	}, [element, get, field, following]);

	return (
		<OrbitControls
			ref={controls}
			makeDefault
			enableDamping={false}
			// Zooms toward what's under the pointer, ex. a robot near a wall
			zoomToCursor={!following}
			minDistance={minDistance}
			// Far enough to see across everywhere the camera is kept, see `keepInBounds()`, so zooming out at that edge doesn't
			// move the target away without bound
			maxDistance={framingDistance(field, size) * zoomOut * 2}
			maxPolarAngle={Math.PI / 2 - minElevation}
			onChange={() => {
				const orbitControls = controls.current;
				if (orbitControls) {
					keepInBounds(orbitControls.object, orbitControls.target, field, size);
				}
			}}
		/>
	);
}

/**
 * Each field's view while the app is open, by the scene's `viewKey`, so it's kept when the scene is drawn again, ex.
 * after its pane is split or moved, or the widget goes back to 3D
 */
const keptViews = new Map<string, { orbit: Orbit; azimuth: number }>();

/** Moves the camera around the field, and to its default view. Render it inside the scene's canvas. */
export function FieldCameraRig({ ref, field, viewKey }: { ref: Ref<Rig>; field: FieldFraming; viewKey?: string }) {
	// three.js objects are changed in place, outside of React's state
	const get = useThree((state) => state.get);
	const controls = useThree((state) => state.controls);
	const transition = useMotionTransition({ duration: 0.3, ease: easing.inOut });
	const moving = useRef<AnimationPlaybackControls>(undefined);

	const center = () => new Vector3(field.length / 2, field.width / 2, 0);

	const current = (): Orbit => {
		const { camera, controls: orbitControls } = get();
		const target = isControls(orbitControls) ? orbitControls.target.clone() : center();
		const offset = new Vector3().subVectors(camera.position, target);
		const distance = offset.length();
		return {
			target,
			azimuth: Math.atan2(offset.y, offset.x),
			elevation: Math.asin(MathUtils.clamp(offset.z / distance, -1, 1)),
			distance,
		};
	};

	const place = ({ target, azimuth, elevation, distance }: Orbit) => {
		const { camera, controls: orbitControls, invalidate, size } = get();
		const flat = Math.cos(elevation) * distance;
		camera.position.set(
			target.x + Math.cos(azimuth) * flat,
			target.y + Math.sin(azimuth) * flat,
			target.z + Math.sin(elevation) * distance,
		);
		keepInBounds(camera, target, field, size);
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

	const resetOrbit = (): Orbit => ({
		target: center(),
		azimuth: field.azimuth,
		elevation: resetElevation,
		distance: framingDistance(field, get().size),
	});

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
					distance: from.distance * (to.distance / from.distance) ** progress,
				}),
		});
	};

	const lastOrbit = useRef(Number.NEGATIVE_INFINITY);
	/** The position the camera follows, where it was last */
	const followed = useRef<Vector3>(undefined);

	useImperativeHandle(ref, () => ({
		reset: () => animateTo(resetOrbit()),
		lookFrom: (direction) => {
			const horizontal = Math.hypot(direction.x, direction.y);
			animateTo({
				...current(),
				azimuth: horizontal < 1e-6 ? current().azimuth : Math.atan2(direction.y, direction.x),
				elevation: MathUtils.clamp(Math.atan2(direction.z, horizontal), minElevation, maxElevation),
			});
		},
		follow: (position) => {
			const last = followed.current;
			followed.current = position?.clone();
			if (position === undefined || (last !== undefined && last.equals(position))) {
				return;
			}
			stop();
			const orbit = current();
			// Starts by looking at the robot, then moves with it
			place({ ...orbit, target: last === undefined ? position.clone() : orbit.target.add(position).sub(last) });
		},
		stop,
		orbit: (azimuth, elevation) => {
			const state = get();
			const now = performance.now();
			if (isControls(state.controls) && followed.current === undefined && now - lastOrbit.current >= gestureGap) {
				aim(state, state.controls.target, viewCenter, field);
			}
			lastOrbit.current = now;
			const orbit = current();
			place({
				...orbit,
				azimuth: orbit.azimuth + azimuth,
				elevation: MathUtils.clamp(orbit.elevation + elevation, minElevation, maxElevation),
			});
		},
		zoom: (seconds) => {
			const orbit = current();
			const distance = seconds * keyboardMoveSpeed;
			if (followed.current === undefined) {
				orbit.target.addScaledVector(get().camera.getWorldDirection(new Vector3()), distance);
			} else {
				// Keep looking at the followed robot and stop before passing through it
				orbit.distance = Math.max(minDistance, orbit.distance - distance);
			}
			place(orbit);
		},
		pan: (right, up) => {
			const { camera } = get();
			const orbit = current();
			const rightAxis = new Vector3().setFromMatrixColumn(camera.matrix, 0);
			const upAxis = new Vector3().setFromMatrixColumn(camera.matrix, 1);
			orbit.target
				.addScaledVector(rightAxis, right * keyboardMoveSpeed)
				.addScaledVector(upAxis, up * keyboardMoveSpeed);
			place(orbit);
		},
	}));

	// Frame the field once the controls exist, they move the camera when they're created, and again when the default
	// view's direction changes
	const framed = useRef<number>(undefined);
	useEffect(() => {
		if (controls && framed.current !== field.azimuth) {
			const first = framed.current === undefined;
			framed.current = field.azimuth;
			if (first) {
				const kept = viewKey === undefined ? undefined : keptViews.get(viewKey);
				place(kept?.azimuth === field.azimuth ? kept.orbit : resetOrbit());
			} else {
				animateTo(resetOrbit());
			}
		}
	});
	const keep = useEffectEvent(() => {
		if (viewKey !== undefined && framed.current !== undefined) {
			keptViews.set(viewKey, { orbit: current(), azimuth: framed.current });
		}
	});
	useEffect(
		() => () => {
			moving.current?.stop();
			keep();
		},
		[],
	);

	return null;
}
