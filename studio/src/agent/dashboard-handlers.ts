// Agent commands for dashboards, through the same functions the user's edits use, so they're undoable, saved, and shared
import type { RegisteredRouter } from '@tanstack/react-router';
import { AgentError } from '@/agent/agent-error';
import type { Handlers } from '@/agent/commands';
import { createInputLayout, describeLayout, tooManyPanes } from '@/agent/layouts';
import { currentDashboard, showNewDashboard } from '@/commands/commands';
import {
	createDashboard,
	type Dashboard,
	deleteDashboard,
	duplicateDashboards,
	getDashboard,
	getDashboards,
	renameDashboard,
} from '@/dashboards/dashboards';
import { dashboardName } from '@/dashboards/label';
import { splitDashboards } from '@/dashboards/panes';
import { moveDashboardToSection } from '@/dashboards/sharing';
import { flushData, getEntry } from '@/data/data-store';
import { getSource } from '@/data/source';
import { canJoinLayouts, createPane, findPane } from '@/panes/layout';
import { saveCaptureImage } from '@/desktop/capture';

let router: RegisteredRouter | undefined;

/** Lets commands show dashboards in this window, call once the router is created */
export function setAgentRouter(appRouter: RegisteredRouter): void {
	router = appRouter;
}

function getRouter(): RegisteredRouter {
	if (!router) {
		throw new Error('Agent commands ran before the router was set');
	}
	return router;
}

export async function showDashboard(id: string): Promise<void> {
	await getRouter().navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: id } });
}

export function requireDashboard(id: string): Dashboard {
	const dashboard = getDashboard(id);
	if (!dashboard) {
		throw new AgentError(`There's no dashboard \`${id}\`, see \`dashboard_list\`.`);
	}
	return dashboard;
}

/** A dashboard as `dashboard_get` returns it */
export function describeDashboard(id: string) {
	const dashboard = requireDashboard(id);
	flushData();
	const sourceOpen = getSource() !== undefined;
	return {
		id,
		name: dashboardName(dashboard),
		shared: dashboard.shared,
		problems: sourceOpen ? undefined : ["No source is open, so bindings can't be checked against its entries."],
		layout: describeLayout(dashboard.layout, getEntry, sourceOpen),
	};
}

export const dashboardHandlers: Pick<
	Handlers,
	| 'dashboard_list'
	| 'dashboard_get'
	| 'dashboard_create'
	| 'dashboard_update'
	| 'dashboard_delete'
	| 'dashboard_duplicate'
	| 'dashboard_combine'
	| 'dashboard_capture'
> = {
	dashboard_list: () => {
		const shown = currentDashboard(getRouter())?.id;
		return getDashboards().map((dashboard) => ({
			id: dashboard.id,
			name: dashboardName(dashboard),
			shared: dashboard.shared,
			shown: dashboard.id === shown,
		}));
	},

	dashboard_get: ({ dashboardId }) => describeDashboard(dashboardId),

	dashboard_create: async ({ name, layout }) => {
		flushData();
		const trimmed = name?.trim();
		const { id } = createDashboard('top', {
			name: trimmed === '' ? undefined : trimmed,
			layout: layout ? createInputLayout(layout, getEntry) : createPane(),
		});
		await showNewDashboard(getRouter(), id);
		return describeDashboard(id);
	},

	dashboard_update: ({ dashboardId, name, shared }) => {
		const dashboard = requireDashboard(dashboardId);
		if (name !== undefined) {
			renameDashboard(dashboardId, name);
		}
		const id =
			shared === undefined || shared === dashboard.shared
				? dashboardId
				: (moveDashboardToSection(getRouter(), dashboardId, shared) ?? dashboardId);
		return describeDashboard(id);
	},

	dashboard_delete: ({ dashboardId }) => {
		requireDashboard(dashboardId);
		deleteDashboard(dashboardId);
	},

	dashboard_duplicate: async ({ dashboardId }) => {
		requireDashboard(dashboardId);
		const [copyId] = duplicateDashboards([dashboardId]);
		await showDashboard(copyId!);
		return describeDashboard(copyId!);
	},

	dashboard_combine: async ({ dashboardIds }) => {
		const dashboards = dashboardIds.map((id) => requireDashboard(id));
		if (new Set(dashboardIds).size !== dashboardIds.length) {
			throw new AgentError('Each dashboard can only be combined once.');
		}
		if (!canJoinLayouts(dashboards.map((dashboard) => dashboard.layout))) {
			throw tooManyPanes('row');
		}
		const [first] = dashboardIds;
		// Shown first, like the user combining them, so closing the others doesn't show another dashboard
		await showDashboard(first!);
		splitDashboards(dashboardIds);
		return describeDashboard(first!);
	},

	dashboard_capture: async (input) => {
		if (STUDIO_DESKTOP) {
			const dashboard = requireDashboard(input.dashboardId);
			if (input.paneId !== undefined && !findPane(dashboard.layout, input.paneId)) {
				throw new AgentError(`The dashboard has no pane \`${input.paneId}\`, see \`dashboard_get\`.`);
			}
			return { path: await saveCaptureImage(getRouter(), input) };
		}
		return undefined;
	},
};
