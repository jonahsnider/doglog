// Missing assets return 404 while client-side routes serve `index.html`. Shared links get team-only preview images.
import { dashboardIdPattern } from '../src/link-previews/dashboard-link-preview.ts';

const linkPrefix = '/shared/';

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
		const dashboardId = url.pathname.slice(linkPrefix.length).replace(/\/$/u, '');
		if (!dashboardIdPattern.test(dashboardId)) {
			return page;
		}

		return new HTMLRewriter()
			.on('meta[property="og:image"]', {
				element(element) {
					element.setAttribute('content', `https://cloud.doglog.dev/dashboard-links/${dashboardId}/preview.png`);
				},
			})
			.transform(page);
	},
} satisfies ExportedHandler<{ ASSETS: Fetcher }>;
