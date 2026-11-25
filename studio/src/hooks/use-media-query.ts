import { useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches. Unlike Astryx's `useMediaQuery`, it's right on the first render, so the phone
 * layout doesn't start out as the desktop one.
 */
export function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const list = window.matchMedia(query);
			list.addEventListener('change', onChange);
			return () => list.removeEventListener('change', onChange);
		},
		() => window.matchMedia(query).matches,
		() => false,
	);
}
