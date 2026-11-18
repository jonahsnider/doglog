import { RouterProvider, createRouter } from '@tanstack/react-router';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { serveAgents } from './agent/desktop.ts';
import { setAgentRouter } from './agent/dashboard-handlers.ts';
import { registerWebMcpTools } from './agent/webmcp.ts';
import { setUpAppMenu } from './desktop/app-menu.ts';
import { trackHistory } from './commands/history.ts';
import { handleLaunchedLogFiles, handleLogFileDrops, handleOpenedLogFiles } from './data/open-log.ts';
import { reopenDevLog } from './data/source.ts';
import { syncMediaSession } from './timeline/media-session.ts';
import { routeTree } from './routeTree.gen.ts';
import { syncTheme } from './settings.ts';
import { startSharing } from './sharing/sharing.ts';
import { runLogSync } from './sync/sync.ts';

syncTheme();
syncMediaSession();
startSharing();
handleLogFileDrops();
if (isTauri()) {
	void handleOpenedLogFiles();
	void runLogSync();
} else {
	handleLaunchedLogFiles();
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
void setUpAppMenu(router);
setAgentRouter(router);
if (isTauri()) {
	void serveAgents(router);
} else {
	registerWebMcpTools();
}

createRoot(document.querySelector('#root')!).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);

// The window starts hidden and is shown once it's restored, see `window_state.rs`
if (isTauri()) {
	void getCurrentWindow().show();
}
