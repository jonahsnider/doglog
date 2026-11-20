import { ClaudeCode, CodexLight, CursorLight, GoogleAntigravity, VisualStudioCode } from '@ridemountainpig/svgl-react';
import { invoke } from '@tauri-apps/api/core';
import CopyIcon from 'lucide-react/icons/copy';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { FramePanel } from '@/components/ui/frame';
import { toastManager } from '@/components/ui/toast';

const agentIcons = {
	'antigravity-cli': GoogleAntigravity,
	'claude-code': ClaudeCode,
	codex: CodexLight,
	cursor: CursorLight,
	'vs-code': VisualStudioCode,
};

/** A coding agent on this computer that Studio can add its MCP server to */
interface Agent {
	id: keyof typeof agentIcons;
	name: string;
}

/** Settings panel to add Studio's MCP server to coding agents, needs the `doglog` command */
export function AgentsField() {
	const [agents, setAgents] = useState<Agent[]>();
	// Null when the `doglog` command isn't installed
	const [config, setConfig] = useState<string | null>();

	useEffect(() => {
		void invoke<Agent[]>('mcp_agents').then(setAgents);
		void invoke<string | null>('mcp_config').then(setConfig);
	}, []);

	if (agents === undefined || config === undefined || config === null) {
		return null;
	}

	return (
		<FramePanel>
			<Field name="agents">
				<FieldLabel>Coding agents</FieldLabel>
				{agents.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{agents.map((agent) => (
							<AddAgentButton key={agent.id} agent={agent} />
						))}
					</div>
				)}
				<FieldDescription>
					Let agents build dashboards for you. Add Studio to others with this MCP config:
				</FieldDescription>
				<div className="relative w-full rounded-lg border bg-muted">
					<pre className="overflow-x-auto p-3 font-mono text-xs select-text">{config}</pre>
					<Button
						variant="ghost"
						size="icon-xs"
						className="absolute top-2 right-2"
						aria-label="Copy MCP config"
						onClick={() => void copyConfig(config)}
					>
						<CopyIcon />
					</Button>
				</div>
			</Field>
		</FramePanel>
	);
}

async function copyConfig(config: string) {
	await navigator.clipboard.writeText(config);
	toastManager.add({ type: 'success', title: 'Copied the MCP config' });
}

function AddAgentButton({ agent }: { agent: Agent }) {
	const Icon = agentIcons[agent.id];
	const [adding, setAdding] = useState(false);

	async function add() {
		setAdding(true);
		try {
			await invoke('install_mcp', { agent: agent.id });
			// Cursor asks to confirm in its own window
			if (agent.id !== 'cursor') {
				toastManager.add({ type: 'success', title: `Added Studio to ${agent.name}` });
			}
		} catch (error) {
			toastManager.add({ type: 'error', title: `Couldn't add Studio to ${agent.name}`, description: String(error) });
		} finally {
			setAdding(false);
		}
	}

	return (
		<Button variant="outline" size="sm" loading={adding} onClick={() => void add()}>
			<Icon aria-hidden="true" className="brightness-0 in-data-loading:invisible dark:invert" />
			Add to {agent.name}
		</Button>
	);
}
