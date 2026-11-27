import { createAtom } from '@tanstack/store';
import { useMediaQuery } from '@/hooks/use-media-query';

// Keep the phone layout in landscape, when the viewport can be wider than the sidebar's mobile breakpoint.
export const mobileLayoutQuery = '(width < 800px), (pointer: coarse) and (height < 480px)';

/** Where a phone dashboard puts its pane tabs, in the top bar, see `PhonePanes` */
export const paneTabsSlot = createAtom<HTMLElement | null>(null);

export function useMobileLayout(): boolean {
	const mobile = useMediaQuery(mobileLayoutQuery);
	return !STUDIO_DESKTOP && mobile;
}

export function isMobileLayout(): boolean {
	return !STUDIO_DESKTOP && typeof window !== 'undefined' && window.matchMedia(mobileLayoutQuery).matches;
}
