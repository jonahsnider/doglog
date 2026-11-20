import { dashboardLinkPreview } from '@doglog/studio/link-previews/dashboard-link-preview.ts';
import { renderPreviewImage } from '@doglog/studio/link-previews/preview-image.tsx';
import { defineHandler } from 'void';

/** The image link previews of a Studio dashboard link show, drawn from the link alone without storing or logging it */
export const GET = defineHandler(async (c) => {
	const preview = await dashboardLinkPreview(c.req.param('link') ?? '');
	if (preview === undefined) {
		return c.notFound();
	}
	return c.body(await renderPreviewImage(preview), 200, {
		'Content-Type': 'image/png',
		// A day, so changes to how previews look reach link previewers' caches
		'Cache-Control': 'public, max-age=86400',
	});
});
