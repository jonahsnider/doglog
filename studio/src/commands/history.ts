import type { RegisteredRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { type Dashboard, getDashboards, useDashboards } from '@/dashboards/dashboards';

export type HistoryStep = -1 | 1;

interface History {
	pathnames: (string | undefined)[];
	index: number;
}

/**
 * The page at each of the window's history entries, mirrored from the router's history since browsers don't expose them.
 * Lets Back and Forward skip closed dashboards. Entries from before Studio last loaded are unknown.
 */
const historyStore = createAtom<History>({ pathnames: [], index: 0 });

const dashboardPath = '/dashboards/';

export function trackHistory(router: RegisteredRouter): void {
	const record = (location: (typeof router.history)['location'], push: boolean) => {
		// oxlint-disable-next-line eslint/no-underscore-dangle -- The router's own index for the entry
		const index = location.state.__TSR_index;
		historyStore.set(({ pathnames }) => {
			const next = push ? pathnames.slice(0, index) : [...pathnames];
			next[index] = location.pathname;
			return { pathnames: next, index };
		});
	};
	record(router.history.location, false);
	router.history.subscribe(({ location, action }) => record(location, action.type === 'PUSH'));
}

/**
 * How far to go in history to reach the nearest page in `step`'s direction that's still open. Skips entries for the current
 * page too, which closing a dashboard leaves behind when it shows the page that was open before it.
 */
function findDelta({ pathnames, index }: History, step: HistoryStep, dashboards: Dashboard[]): number | undefined {
	for (let other = index + step; other >= 0 && other < pathnames.length; other += step) {
		const pathname = pathnames[other];
		if (pathname === undefined) {
			return undefined;
		}
		if (
			pathname !== pathnames[index] &&
			(!pathname.startsWith(dashboardPath) || dashboards.some((dashboard) => pathname === dashboardPath + dashboard.id))
		) {
			return other - index;
		}
	}
	return undefined;
}

/** Like a browser's Back and Forward, skipping closed dashboards */
export function goInHistory(router: RegisteredRouter, step: HistoryStep): void {
	const delta = findDelta(historyStore.get(), step, getDashboards());
	if (delta !== undefined) {
		router.history.go(delta);
	}
}

export function canGoInHistory(step: HistoryStep): boolean {
	return findDelta(historyStore.get(), step, getDashboards()) !== undefined;
}

export function useCanGoInHistory(step: HistoryStep): boolean {
	const dashboards = useDashboards();
	return findDelta(useSelector(historyStore), step, dashboards) !== undefined;
}
