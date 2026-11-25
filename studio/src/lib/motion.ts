import { resolveThemeTokens } from '@astryxdesign/core/theme/tokens';
import { useSelector } from '@tanstack/react-store';
import { team581Theme } from '@team581/astryx-theme/themes/team581';
// oxlint-disable-next-line eslint/no-restricted-imports -- This module implements useMotionTransition().
import { type Transition, useReducedMotion } from 'motion/react';
import { settingsStore } from '@/settings';

// Motion tokens are the same in light and dark
const tokens = resolveThemeTokens(team581Theme, { mode: 'light' });

function curve(token: string): [number, number, number, number] {
	const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = tokens[token]!.slice('cubic-bezier('.length, -1).split(',').map(Number);
	return [x1, y1, x2, y2];
}

function seconds(token: string): number {
	return Number(tokens[token]!.slice(0, -'ms'.length)) / 1000;
}

/** Astryx's `--ease-*` tokens, for the motion library */
export const easing = {
	/** `--ease-standard`, for state changes */
	standard: curve('--ease-standard'),
	/** `--ease-entrance`, for things arriving */
	entrance: curve('--ease-entrance'),
	/** `--ease-move`, for things moving on screen */
	move: curve('--ease-move'),
	/** `--ease-exit`, for things leaving */
	exit: curve('--ease-exit'),
} as const;

/** Astryx's `--duration-*` tokens in seconds, for the motion library */
export const duration = {
	fastMin: seconds('--duration-fast-min'),
	fast: seconds('--duration-fast'),
	fastMax: seconds('--duration-fast-max'),
	mediumMin: seconds('--duration-medium-min'),
	medium: seconds('--duration-medium'),
	exit: seconds('--duration-exit'),
} as const;

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
