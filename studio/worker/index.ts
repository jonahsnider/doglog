// Existing static assets bypass this Worker (except `/import/*`, see `run_worker_first` in wrangler.jsonc).
// Unmatched requests come here so missing assets return 404 while client-side routes serve `index.html` (and `/import/*`
// gets dashboard-specific Open Graph tags).
import {
	dashboardLinkDescription,
	dashboardLinkImageUrl,
	dashboardLinkPreview,
} from '../src/link-previews/dashboard-link-preview.ts';

const linkPrefix = '/import/';

function isMissingAsset(request: Request, url: URL): boolean {
	if (url.pathname.startsWith('/assets/')) {
		return true;
	}
	const dest = request.headers.get('Sec-Fetch-Dest');
	return dest !== null && dest !== 'document' && dest !== 'iframe';
}

export default {
	async fetch(request, env) {
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return new Response(null, { status: 405 });
		}
		const url = new URL(request.url);
		if (isMissingAsset(request, url)) {
			return new Response(null, { status: 404 });
		}

		// The app's `index.html`, which routes the path on the client
		const page = await env.ASSETS.fetch(new Request(new URL('/', url), { method: request.method }));
		if (!url.pathname.startsWith(linkPrefix)) {
			return page;
		}
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
