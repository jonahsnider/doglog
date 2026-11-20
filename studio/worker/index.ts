// Runs only for dashboard links (`/import/*`, see `run_worker_first` in wrangler.jsonc), so their link previews show
// the dashboard instead of the generic tags in `index.html`. Every other path is served as a static asset.
import {
	dashboardLinkDescription,
	dashboardLinkImageUrl,
	dashboardLinkPreview,
} from '../src/link-previews/dashboard-link-preview.ts';

const linkPrefix = '/import/';

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		// The app's `index.html`, which routes the link on the client
		const page = await env.ASSETS.fetch(new URL('/', url));
		const link = url.pathname.slice(linkPrefix.length);
		const preview = await dashboardLinkPreview(link);
		if (preview === undefined) {
			return page;
		}

		const content: Record<string, string> = {
			'og:title': preview.title,
			'og:description': dashboardLinkDescription,
			'og:image': dashboardLinkImageUrl(link),
			'og:image:alt': `The panes of the ${preview.title} dashboard`,
		};
		return new HTMLRewriter()
			.on('meta[property^="og:"]', {
				element(element) {
					const value = content[element.getAttribute('property') ?? ''];
					if (value !== undefined) {
						// `setAttribute()` only escapes quotes, ex. a dashboard named `R&amp;D` would show as `R&D`
						element.setAttribute('content', value.replaceAll('&', '&amp;'));
					}
				},
			})
			.transform(page);
	},
} satisfies ExportedHandler<{ ASSETS: Fetcher }>;
