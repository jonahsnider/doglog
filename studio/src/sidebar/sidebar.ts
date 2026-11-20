import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

/** Whether the sidebar only shows icons */
export const sidebarCollapsedStore = createPersistedAtom('sidebar-collapsed', z.boolean(), false, { perWindow: true });

/**
 * The step playing after the sidebar's toggle is clicked, see `toggleSidebarCollapsed()`. With the macOS title bar's
 * strip, the main area moves below the strip before the sidebar collapses, and the sidebar expands before the main area
 * moves back up, so the main area goes around the title bar instead of under it.
 */
export const sidebarAnimationStore = createAtom<'enter-strip' | 'collapse' | 'expand' | 'leave-strip' | undefined>(
	undefined,
);

/** How long the sidebar takes to collapse or expand, like its `duration-200` */
const resizeDuration = 200;
/** How long the main area takes to move to or from below the title bar's strip, like its `duration-150` */
const stripDuration = 150;
let animationTimer: ReturnType<typeof setTimeout> | undefined;

/** Collapses or expands the sidebar, in steps when `animate`, which include moving the main area when there's a `strip` */
export function toggleSidebarCollapsed(animate: boolean, strip: boolean): void {
	clearTimeout(animationTimer);
	const expanding = sidebarCollapsedStore.get();
	sidebarCollapsedStore.set(!expanding);
	if (!animate) {
		sidebarAnimationStore.set(undefined);
	} else if (expanding) {
		sidebarAnimationStore.set('expand');
		animationTimer = setTimeout(() => {
			sidebarAnimationStore.set(strip ? 'leave-strip' : undefined);
			animationTimer = setTimeout(() => sidebarAnimationStore.set(undefined), stripDuration);
		}, resizeDuration);
	} else {
		sidebarAnimationStore.set(strip ? 'enter-strip' : 'collapse');
		animationTimer = setTimeout(
			() => sidebarAnimationStore.set(undefined),
			(strip ? stripDuration : 0) + resizeDuration,
		);
	}
}
