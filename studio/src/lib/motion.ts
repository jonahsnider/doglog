import { type Transition, useReducedMotion } from 'motion/react';

/** The Material 3 curves behind Tailwind's `ease-*` classes in `index.css`, for the motion library */
export const easing = {
	/** Standard, for things that move within the screen */
	inOut: [0.2, 0, 0, 1],
	/** Standard decelerate, for things entering the screen */
	out: [0, 0, 0, 1],
	/** Standard accelerate, for things leaving the screen */
	in: [0.3, 0, 1, 1],
} as const satisfies Record<string, [number, number, number, number]>;

/** A motion transition that's instant when the system is set to reduce motion */
export function useMotionTransition(transition: Transition): Transition {
	return (useReducedMotion() ?? false) ? { duration: 0 } : transition;
}
