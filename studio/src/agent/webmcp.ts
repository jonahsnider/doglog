// Offers agent commands to the browser's agent with WebMCP, https://webmachinelearning.github.io/webmcp/
import * as z from 'zod';
import { availableCommands, runAgentCommand } from '@/agent/registry';

/** The parts of WebMCP's `ModelContext` Studio uses */
type ModelContext = {
	registerTool: (tool: {
		name: string;
		description: string;
		inputSchema: object;
		execute: (input: object) => Promise<unknown>;
	}) => Promise<void>;
};

declare global {
	interface Document {
		/** Only in browsers with WebMCP */
		readonly modelContext?: ModelContext;
	}
}

/** Offer every command to the browser's agent, for this tab only. Does nothing in browsers without WebMCP. */
export function registerWebMcpTools(): void {
	const { modelContext } = document;
	if (!modelContext) {
		return;
	}

	for (const { name, description, input } of availableCommands) {
		void modelContext.registerTool({
			name,
			description,
			inputSchema: z.toJSONSchema(input, { io: 'input' }),
			execute: (args) => runAgentCommand(name, args),
		});
	}
}
