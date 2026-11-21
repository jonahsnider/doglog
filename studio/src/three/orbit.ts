// Helpers for orbiting cameras, shared by the robot and field scenes
import type { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { type ComponentRef, type RefObject, useEffect } from 'react';
import { MOUSE, type Vector3 } from 'three';

/** How many times as fast the camera zooms and pans while Shift is held */
export const shiftSpeedup = 2;

/** The parts of drei's orbit controls the camera rig moves */
type Controls = { target: Vector3; update: () => void };

export function isControls(value: unknown): value is Controls {
	return typeof value === 'object' && value !== null && 'target' in value && 'update' in value;
}

/** The angle from `from` to `to` the short way around */
export function turn(from: number, to: number): number {
	return ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

/**
 * Makes drei's orbit `controls` zoom and pan at `speed`, and faster while Shift is held. Use it inside the scene's
 * canvas.
 */
export function useShiftSpeedup(controls: RefObject<ComponentRef<typeof OrbitControls> | null>, speed = 1) {
	// Where drei's orbit controls listen for input
	const element = useThree((state) => {
		const connected: unknown = state.events.connected;
		return connected instanceof HTMLElement ? connected : state.gl.domElement;
	});

	useEffect(() => {
		// Runs before the controls handle the event, which they listen for without capturing
		const onInput = (event: PointerEvent | WheelEvent) => {
			const orbitControls = controls.current;
			if (!orbitControls) {
				return;
			}
			const inputSpeed = event.shiftKey ? speed * shiftSpeedup : speed;
			orbitControls.zoomSpeed = inputSpeed;
			orbitControls.panSpeed = inputSpeed;
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
	}, [element, controls, speed]);
}
