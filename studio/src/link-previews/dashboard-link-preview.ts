// What link previews of dashboard links show, worked out on the server from the link alone. Links aren't stored or
// logged, so dashboards stay on the devices they're opened on.
import { decodeDashboardLink } from '@/dashboards/dashboard-link';
import { dashboardName } from '@/dashboards/label';
import type { PaneNode } from '@/panes/layout';
import { restoreLayout } from '@/panes/layout-snapshot';

/** Serves the images of dashboard links' previews, see `cloud/routes/dashboard-links` */
const cloudOrigin = 'https://cloud.doglog.dev';

export const dashboardLinkDescription = 'Open this dashboard in DogLog Studio.';

/** A dashboard link's title and layout, from its last path segment. `undefined` for invalid or unsupported links. */
export async function dashboardLinkPreview(link: string): Promise<{ title: string; layout: PaneNode } | undefined> {
	const snapshot = await decodeDashboardLink(link).catch(() => undefined);
	if (snapshot === undefined) {
		return undefined;
	}
	const layout = restoreLayout(snapshot.layout);
	return { title: dashboardName({ name: snapshot.name, layout }), layout };
}

export function dashboardLinkImageUrl(link: string): string {
	return `${cloudOrigin}/dashboard-links/${link}/preview.png`;
}
