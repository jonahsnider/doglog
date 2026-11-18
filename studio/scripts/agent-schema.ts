// Writes the agent commands' schemas to `src-tauri/agent-api.json`, which the desktop app embeds so `doglog --help` and
// the MCP server's tool list work without a window. `--check` fails instead if the file is out of date.
import { readFile, writeFile } from 'node:fs/promises';
import * as z from 'zod';
import { agentApiVersion, agentInstructions, platformCommands } from '../src/agent/commands.ts';

const path = new URL('../src-tauri/agent-api.json', import.meta.url);

const api = {
	apiVersion: agentApiVersion,
	instructions: agentInstructions,
	commands: platformCommands('desktop').map(({ name, description, input, bridge }) => ({
		name,
		description,
		inputSchema: z.toJSONSchema(input, { io: 'input' }),
		bridge,
	})),
};
const json = `${JSON.stringify(api, undefined, '\t')}\n`;

if (process.argv.includes('--check')) {
	if ((await readFile(path, 'utf8')) !== json) {
		throw new Error('src-tauri/agent-api.json is out of date, run `pnpm agent:schema`');
	}
} else {
	await writeFile(path, json);
}
