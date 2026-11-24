import * as Sentry from '@sentry/react';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { serveAgents } from './agent/desktop.ts';
import { setAgentRouter } from './agent/dashboard-handlers.ts';
import { registerWebMcpTools } from './agent/webmcp.ts';
import { setUpAppMenu } from './desktop/app-menu.ts';
import { trackHistory } from './commands/history.ts';
import { handleOpenedDashboardLinks } from './dashboards/open-dashboard-link.ts';
import { handleDroppedLogPaths, handleLaunchedLogFiles, handleOpenedLogFiles } from './data/open-log.ts';
import { restoreLive } from './data/restore-live.ts';
import { getSources, reopenDevLog, subscribeSource } from './data/source.ts';
import { syncMediaSession } from './timeline/media-session.ts';
import { routeTree } from './routeTree.gen.ts';
import { syncTheme } from './settings.ts';
import { StudioTheme } from './theme/studio-theme.tsx';
import { startSharing } from './sharing/sharing.ts';
import { runLogSync } from './sync/sync.ts';
import { registerServiceWorker } from './updater.ts';

const preloadReloadKey = 'doglog-studio:preload-reload';
const preloadReloadCooldownMs = 30_000;

/** Reload once when an uncontrolled tab fails to fetch a chunk a newer deploy removed. */
function handlePreloadError(event: Event): void {
	if (!navigator.onLine) {
		return;
	}
	try {
		const stored = sessionStorage.getItem(preloadReloadKey);
		const lastReload = stored === null ? Number.NaN : Number(stored);
		if (Number.isFinite(lastReload) && Date.now() - lastReload < preloadReloadCooldownMs) {
			return;
		}
		sessionStorage.setItem(preloadReloadKey, String(Date.now()));
	} catch {
		// Without storage to prevent a reload loop, let the error surface instead
		return;
	}
	event.preventDefault();
	location.reload();
}

// Web previews serve the production bundle on loopback; local desktop packages are marked at build time.
const localPreview =
	import.meta.env.VITE_DOGLOG_LOCAL_PREVIEW === '1' ||
	(!STUDIO_DESKTOP && /^(localhost|127\.[\d.]+|\[::1\])$|\.localhost$/u.test(location.hostname));
const traceWeb = import.meta.env.PROD && !STUDIO_DESKTOP && !localPreview;

// Reports uncaught errors from production-mode builds, with the release set by the build plugin.
Sentry.init({
	dsn: 'https://cc0e3a691d3ee00a449b2ee4ea3d55f3@o141130.ingest.us.sentry.io/4512455446495232',
	enabled: import.meta.env.PROD,
	environment: import.meta.env.DEV || localPreview ? 'development' : 'production',
	initialScope: { tags: { platform: STUDIO_DESKTOP ? 'desktop' : 'web' } },
	...(traceWeb && {
		tracesSampleRate: 0.1,
		integrations: [Sentry.browserTracingCoreIntegration()],
		beforeSendSpan(span) {
			// Page URLs and referrers can contain log URLs or encoded dashboard contents.
			delete span.attributes['url.full'];
			delete span.attributes['url.path'];
			delete span.attributes['http.request.header.referer'];
			return span;
		},
		beforeSend(event) {
			// Browser tracing also adds the raw pathname as the transaction name on error events.
			delete event.transaction;
			return event;
		},
	}),
});

syncTheme();
syncMediaSession();
startSharing();
if (STUDIO_DESKTOP) {
	if ('__DOGLOG_FROSTED_FRAME__' in window) {
		document.documentElement.dataset['frostedFrame'] = '';
	}
	void handleOpenedLogFiles();
	void handleDroppedLogPaths();
	void runLogSync();
	let lastHasSource = false;
	subscribeSource(() => {
		const { log, live } = getSources();
		const hasSource = log !== undefined || live !== undefined;
		if (hasSource !== lastHasSource) {
			lastHasSource = hasSource;
			void invoke('set_window_has_source', { hasSource }).catch(() => {});
		}
	});
} else {
	handleLaunchedLogFiles();
	if (import.meta.env.PROD) {
		addEventListener('vite:preloadError', handlePreloadError);
		// Waits for the page to load so precaching doesn't compete with it. HTTP pages other than localhost, ex. Studio
		// served on a LAN IP, have no `navigator.serviceWorker`. Registering also checks for a newer version.
		if ('serviceWorker' in navigator) {
			addEventListener('load', () => void registerServiceWorker());
		}
	}
}
void restoreLive();
if (import.meta.env.DEV) {
	void reopenDevLog();
}

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}

trackHistory(router);
setAgentRouter(router);
if (STUDIO_DESKTOP) {
	void setUpAppMenu(router);
	void serveAgents(router);
	void handleOpenedDashboardLinks(router);
} else {
	registerWebMcpTools();
}

createRoot(document.querySelector('#root')!, {
	// Uncaught errors already reach Sentry's global handler, but errors caught by an error boundary (ex. the router's) don't
	onCaughtError: import.meta.env.PROD ? Sentry.reactErrorHandler() : undefined,
}).render(
	<StrictMode>
		<StudioTheme>
			<RouterProvider router={router} />
		</StudioTheme>
	</StrictMode>,
);

// The window starts hidden and is shown once it's restored, then revealed after the first page paints, see
// `window_state.rs`. Animation frames only run once it's shown, the second one is after the first page painted.
if (STUDIO_DESKTOP) {
	void getCurrentWindow().show();
	const unsubscribe = router.subscribe('onRendered', () => {
		unsubscribe();
		requestAnimationFrame(() => {
			requestAnimationFrame(() => void invoke('reveal_window'));
		});
	});
}
