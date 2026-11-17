import { RouterProvider, createRouter } from '@tanstack/react-router';
import { isTauri } from '@tauri-apps/api/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { setUpAppMenu } from './commands/commands.ts';
import { handleLogFileDrops, handleOpenedLogFiles, reopenDevLog } from './data/source.ts';
import { syncMediaSession } from './timeline/media-session.ts';
import { routeTree } from './routeTree.gen.ts';
import { syncTheme } from './settings.ts';
import { runLogSync } from './sync/sync.ts';

syncTheme();
syncMediaSession();
handleLogFileDrops();
if (isTauri()) {
	void handleOpenedLogFiles();
	void runLogSync();
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

void setUpAppMenu(router);

createRoot(document.querySelector('#root')!).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
