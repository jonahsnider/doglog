import * as Sentry from '@sentry/react';
import { RouterProvider, createRouter } from '@tanstack/react-router';
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
import { handleLaunchedLogFiles, handleLogFileDrops, handleOpenedLogFiles } from './data/open-log.ts';
import { reopenDevLog } from './data/source.ts';
import { syncMediaSession } from './timeline/media-session.ts';
import { routeTree } from './routeTree.gen.ts';
import { syncTheme } from './settings.ts';
import { startSharing } from './sharing/sharing.ts';
import { runLogSync } from './sync/sync.ts';
import { registerServiceWorker } from './updater.ts';

// Web previews serve the production bundle on loopback; local desktop packages are marked at build time.
const localPreview =
	import.meta.env.VITE_DOGLOG_LOCAL_PREVIEW === '1' ||
	(!STUDIO_DESKTOP && /^(localhost|127\.[\d.]+|\[::1\])$|\.localhost$/u.test(location.hostname));

// Reports uncaught errors from production-mode builds, with the release set by the build plugin.
Sentry.init({
	dsn: 'https://cc0e3a691d3ee00a449b2ee4ea3d55f3@o141130.ingest.us.sentry.io/4512455446495232',
	enabled: import.meta.env.PROD,
	environment: import.meta.env.DEV || localPreview ? 'development' : 'production',
	initialScope: { tags: { platform: STUDIO_DESKTOP ? 'desktop' : 'web' } },
});

syncTheme();
syncMediaSession();
startSharing();
handleLogFileDrops();
if (STUDIO_DESKTOP) {
	if ('__DOGLOG_FROSTED_FRAME__' in window) {
		document.documentElement.dataset['frostedFrame'] = '';
	}
	void handleOpenedLogFiles();
	void runLogSync();
} else {
	handleLaunchedLogFiles();
	// Waits for the page to load so precaching doesn't compete with it. HTTP pages other than localhost, ex. Studio
	// served on a LAN IP, have no `navigator.serviceWorker`. Registering also checks for a newer version.
	if (import.meta.env.PROD && 'serviceWorker' in navigator) {
		addEventListener('load', () => void registerServiceWorker());
	}
}
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
		<RouterProvider router={router} />
	</StrictMode>,
);

// The window starts hidden and is shown once it's restored, see `window_state.rs`
if (STUDIO_DESKTOP) {
	void getCurrentWindow().show();
}
