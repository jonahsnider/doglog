import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { setUpAppMenu } from './commands.ts';
import { handleLogFileDrops } from './data/source.ts';
import { routeTree } from './routeTree.gen.ts';
import { syncTheme } from './settings.ts';

syncTheme();
handleLogFileDrops();

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
