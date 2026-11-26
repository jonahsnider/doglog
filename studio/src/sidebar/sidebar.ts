import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import { duration } from '@/lib/motion';
import { createPersistedAtom } from '@/lib/persisted-store';

/** Whether the sidebar only shows icons */
export const sidebarCollapsedStore = createPersistedAtom('sidebar-collapsed', z.boolean(), false, { perWindow: true });

type SidebarAnimation = 'enter-strip' | 'collapse' | 'expand' | 'leave-strip' | 'peek' | 'unpeek';

/**
 * The step playing after the sidebar's toggle is clicked, see `toggleSidebarCollapsed()`, or while the collapsed sidebar
 * starts or stops peeking, see `animateSidebarPeek()`. Collapsing plays expanding's steps in reverse. With the macOS title
 * bar's strip, the main area moves below the strip before the sidebar collapses, and the sidebar expands before the main
 * area moves back up, so the main area goes around the title bar instead of under it.
 */
export const sidebarAnimationStore = createAtom<SidebarAnimation | undefined>(undefined);

/** Whether `animation` is one of the steps of collapsing or of peeking ending, which keep the sidebar's full layout */
export function isCollapsing(animation: SidebarAnimation | undefined): boolean {
	return animation === 'enter-strip' || animation === 'collapse' || animation === 'unpeek';
}

/** How long the sidebar takes to expand, like its width transition */
const resizeDuration = duration.fastMax * 1000;
/** How long the main area takes to move to or from below the title bar's strip */
const stripDuration = duration.fast * 1000;
let animationTimer: ReturnType<typeof setTimeout> | undefined;

/** Plays each timed step in order. AppSidebar clears an untimed final step when its width transitions finish. */
function playSteps(steps: (readonly [SidebarAnimation, number?])[]): void {
	clearTimeout(animationTimer);
	const [step, ...rest] = steps;
	sidebarAnimationStore.set(step?.[0]);
	if (step?.[1] !== undefined) {
		animationTimer = setTimeout(() => playSteps(rest), step[1]);
	}
}

/** Collapses or expands the sidebar, in steps when `animate`, which include moving the main area when there's a `strip` */
export function toggleSidebarCollapsed(animate: boolean, strip: boolean): void {
	const expanding = sidebarCollapsedStore.get();
	sidebarCollapsedStore.set(!expanding);
	if (!animate) {
		playSteps([]);
	} else if (expanding) {
		playSteps([['expand', resizeDuration], ...(strip ? [['leave-strip', stripDuration] as const] : [])]);
	} else {
		playSteps([...(strip ? [['enter-strip', stripDuration] as const] : []), ['collapse']]);
	}
}

/**
 * Copies the sidebar's `content` into the rail's copy under it while it peeks, or only the part matching `selector`,
 * without IDs or anchor names that would duplicate the sidebar's. A popup anchors to the last element with its anchor name,
 * which would be the copy.
 */
export function copyToRail(railCopy: Element, content: Element, selector?: string): void {
	if (selector === undefined) {
		railCopy.replaceChildren(content.cloneNode(true));
	} else {
		railCopy.querySelector(selector)?.replaceWith(content.querySelector(selector)!.cloneNode(true));
	}
	for (const element of railCopy.querySelectorAll('[id]')) {
		element.removeAttribute('id');
	}
	for (const element of railCopy.querySelectorAll<HTMLElement>('[style*="anchor-name"]')) {
		element.style.removeProperty('anchor-name');
	}
}

/** Plays the collapsed sidebar's step for starting to peek over the main area when `shown`, or for stopping */
export function animateSidebarPeek(shown: boolean): void {
	playSteps([[shown ? 'peek' : 'unpeek']]);
}
