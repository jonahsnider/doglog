import { useMediaQuery } from '@/hooks/use-media-query';

// Keep the phone layout in landscape, when the viewport can be wider than the sidebar's mobile breakpoint.
const mobileLayoutQuery = '(width < 800px), (pointer: coarse) and (height < 480px)';

export function useMobileLayout(): boolean {
	const mobile = useMediaQuery(mobileLayoutQuery);
	return !STUDIO_DESKTOP && mobile;
}

export function isMobileLayout(): boolean {
	return !STUDIO_DESKTOP && typeof window !== 'undefined' && window.matchMedia(mobileLayoutQuery).matches;
}
