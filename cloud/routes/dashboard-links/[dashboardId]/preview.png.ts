import { dashboardIdPattern } from '@doglog/studio/link-previews/dashboard-link-preview.ts';
import { renderPreviewImage } from '@doglog/studio/link-previews/preview-image.tsx';
import { ConvexHttpClient } from 'convex/browser';
import { defineHandler } from 'void';
import { api } from '../../../convex/_generated/api';

const convexUrl = import.meta.env['VITE_CONVEX_URL'] ?? 'https://convex.doglog.studio';
const genericImageUrl = 'https://doglog.studio/og.png';

/** Link previews are public and show only the team's name. */
export const GET = defineHandler(async (c) => {
	const dashboardId = c.req.param('dashboardId') ?? '';
	if (!dashboardIdPattern.test(dashboardId)) {
		return c.redirect(genericImageUrl);
	}
	const client = new ConvexHttpClient(convexUrl, { logger: false });
	const team = await client.query(api.cloudDashboards.linkPreview, { dashboardId }).catch(() => null);
	if (team === null) {
		return c.redirect(genericImageUrl);
	}
	return c.body(await renderPreviewImage(team.name), 200, {
		'Content-Type': 'image/png',
		// A day, so changes to how previews look reach link previewers' caches
		'Cache-Control': 'public, max-age=86400',
	});
});
