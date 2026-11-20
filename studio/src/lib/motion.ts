import { useSelector } from '@tanstack/react-store';
// oxlint-disable-next-line eslint/no-restricted-imports -- This module implements useMotionTransition().
import { type Transition, useReducedMotion } from 'motion/react';
import { settingsStore } from '@/settings';

/** The Material 3 curves behind Tailwind's `ease-*` classes in `index.css`, for the motion library */
export const easing = {
	/** Standard, for things that move within the screen */
	inOut: [0.2, 0, 0, 1],
	/** Standard decelerate, for things entering the screen */
	out: [0, 0, 0, 1],
	/** Standard accelerate, for things leaving the screen */
	in: [0.3, 0, 1, 1],
} as const satisfies Record<string, [number, number, number, number]>;

/** Whether to skip animations, because the system or the reduce motion setting asks to */
export function reducesMotion(): boolean {
	return settingsStore.get().reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A motion transition that's instant when the system or the reduce motion setting asks to reduce motion */
export function useMotionTransition(transition: Transition): Transition {
	const systemReducesMotion = useReducedMotion() ?? false;
	const settingReducesMotion = useSelector(settingsStore, (settings) => settings.reduceMotion);
	return systemReducesMotion || settingReducesMotion ? { duration: 0 } : transition;
}
