import type { RegisteredRouter } from '@tanstack/react-router';
import { Channel, invoke } from '@tauri-apps/api/core';
import { AgentError, agentApiVersion, runAgentCommand } from '@/agent/registry';
import { getDashboard } from '@/dashboards/dashboards';
import { dashboardName } from '@/dashboards/label';
import { getSource, sourceName } from '@/data/source';

/** A request from an agent's `doglog` command, relayed by `src-tauri/src/agent/window.rs` */
type AgentRequest = { id: number; method: 'info' } | { id: number; method: 'call'; name: string; args: unknown };

/** Let agents control this window through the `doglog` command, desktop only */
export async function serveAgents(router: RegisteredRouter): Promise<void> {
	const channel = new Channel<AgentRequest>((request) => void respond(router, request));
	await invoke('agent_listen', { channel });
}

async function respond(router: RegisteredRouter, request: AgentRequest): Promise<void> {
	let response;
	try {
		const result = request.method === 'info' ? info(router) : await runAgentCommand(request.name, request.args);
		response = { result };
	} catch (error) {
		response = {
			error: {
				// JSON-RPC's invalid params code, or a command failure
				code: error instanceof AgentError && error.invalidInput ? -32602 : -32000,
				message: error instanceof Error ? error.message : String(error),
			},
		};
	}
	await invoke('agent_respond', { id: request.id, ...response });
}

/** This window's details for `window_list`, the rest come from `window.rs` */
function info(router: RegisteredRouter) {
	const match = router.state.matches.find((other) => other.routeId === '/dashboards/$dashboardId');
	const dashboard = match && getDashboard(match.params.dashboardId);
	return {
		apiVersion: agentApiVersion,
		dashboard: dashboard ? { id: dashboard.id, name: dashboardName(dashboard) } : null,
		source: describeSource(),
	};
}

function describeSource(): string | null {
	const source = getSource();
	if (source === undefined) {
		return null;
	}
	if (source.type === 'log') {
		return source.status === 'loading' ? `${source.fileName} (loading)` : source.fileName;
	}
	return `${sourceName(source)} (${source.status})`;
}
