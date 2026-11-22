import { useMatchRoute } from '@tanstack/react-router';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { useDashboards } from '@/dashboards/dashboards';
import { dashboardName } from '@/dashboards/label';
import { sourceName, useSource } from '@/data/source';

/** macOS already groups an app's windows wherever it lists them, so their titles leave out the app's name */
const appNameInTitle = !(STUDIO_DESKTOP && navigator.userAgent.includes('Mac'));

/**
 * Title the window after the page and source it shows, ex. `Auto tuning (match_q42) — DogLog Studio`, so open tabs and
 * windows can be told apart wherever the system lists them
 */
export function useWindowTitle(): void {
	const matchRoute = useMatchRoute();
	const dashboards = useDashboards();
	const source = useSource();

	const dashboardMatch = matchRoute({ to: '/dashboards/$dashboardId' });
	const dashboard =
		dashboardMatch === false ? undefined : dashboards.find(({ id }) => id === dashboardMatch.dashboardId);
	let page: string | undefined;
	if (dashboard !== undefined) {
		page = dashboardName(dashboard);
	} else if (matchRoute({ to: '/logs' }) !== false) {
		page = 'Logs';
	} else if (matchRoute({ to: '/tuning' }) !== false) {
		page = 'Tuning';
	} else if (matchRoute({ to: '/settings' }) !== false) {
		page = 'Settings';
	}
	// Every log is a `.wpilog`, so the extension doesn't tell windows apart
	const name = source === undefined ? undefined : sourceName(source).replace(/\.wpilog$/iu, '');
	const details = page !== undefined && name !== undefined ? `${page} (${name})` : (page ?? name);
	let title = 'DogLog Studio';
	if (details !== undefined) {
		title = appNameInTitle ? `${details} — DogLog Studio` : details;
	}

	useEffect(() => {
		document.title = title;
		// The desktop window's title isn't kept in sync with the document's
		if (STUDIO_DESKTOP) {
			void getCurrentWindow().setTitle(title);
		}
	}, [title]);
}
