import { Button } from '@astryxdesign/core/Button';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { ClaudeCode, CodexLight, CursorLight, GoogleAntigravity, VisualStudioCode } from '@ridemountainpig/svgl-react';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { toastManager } from '@/components/toast';
import './agents-field.css';

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

/** Setting to add Studio's MCP server to coding agents, needs the `doglog` command */
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
		<VStack gap={2}>
			<Text type="label">Coding agents</Text>
			{agents.length > 0 && (
				<HStack wrap="wrap" gap={2}>
					{agents.map((agent) => (
						<AddAgentButton key={agent.id} agent={agent} />
					))}
				</HStack>
			)}
			<Text type="supporting" color="secondary">
				Let coding agents work with you in Studio. Add Studio to others with this MCP config:
			</Text>
			<CodeBlock code={config} language="json" hasLanguageLabel={false} size="sm" width="100%" />
		</VStack>
	);
}

function AddAgentButton({ agent }: { agent: Agent }) {
	const Icon = agentIcons[agent.id];

	async function add() {
		try {
			await invoke('install_mcp', { agent: agent.id });
			// Cursor asks to confirm in its own window
			if (agent.id !== 'cursor') {
				toastManager.add({ type: 'success', title: `Added Studio to ${agent.name}` });
			}
		} catch (error) {
			toastManager.add({ type: 'error', title: `Couldn't add Studio to ${agent.name}`, description: String(error) });
		}
	}

	return (
		<Button
			label={`Add to ${agent.name}`}
			size="sm"
			icon={<Icon aria-hidden="true" data-agent-icon />}
			clickAction={add}
		/>
	);
}
