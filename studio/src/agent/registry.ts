// Runs agent commands in this window, for WebMCP in the web app and the `doglog` command on desktop
import { isTauri } from '@tauri-apps/api/core';
import * as z from 'zod';
import { AgentError } from '@/agent/agent-error';
import { platformCommands } from '@/agent/commands';
import { handlers } from '@/agent/handlers';

export { AgentError } from '@/agent/agent-error';
export { agentApiVersion } from '@/agent/commands';

/** The commands offered in this window */
export const availableCommands = platformCommands(isTauri() ? 'desktop' : 'web');

function isHandled(name: string): name is keyof typeof handlers {
	return Object.hasOwn(handlers, name);
}

/** Validate a command's input and run it. Throws an `AgentError` for unknown commands and invalid input. */
export async function runAgentCommand(name: string, args: unknown): Promise<unknown> {
	const command = availableCommands.find((other) => other.name === name);
	if (!command || !isHandled(name)) {
		throw new AgentError(
			command ? `\`${name}\` is handled by the doglog MCP server, not a window.` : `There's no \`${name}\` command.`,
			{ invalidInput: true },
		);
	}

	const input = command.input.safeParse(args ?? {});
	if (!input.success) {
		throw new AgentError(`Invalid input for \`${name}\`:\n${z.prettifyError(input.error)}`, { invalidInput: true });
	}
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The input was just validated with the command's schema
	const handler = handlers[name] as (input: unknown) => unknown;
	return (await handler(input.data)) ?? null;
}
