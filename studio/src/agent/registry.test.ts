import { expect, test } from 'vite-plus/test';
import * as z from 'zod';
import { platformCommands } from '@/agent/commands';
import { AgentError, runAgentCommand } from '@/agent/registry';

test('commands reject unknown names and invalid input before running', async () => {
	await expect(runAgentCommand('pane_explode', {})).rejects.toThrow(AgentError);
	const invalid = runAgentCommand('timeline_update', { time: 'soon' });
	await expect(invalid).rejects.toMatchObject({ invalidInput: true });
	await expect(invalid).rejects.toThrow('time');
	// Unknown inputs are mistakes, ex. a web agent trying to open a file
	await expect(runAgentCommand('source_update', { path: '/log.wpilog' })).rejects.toThrow('path');
});

test.each(['web', 'desktop'] as const)('every %s command takes an object, as MCP requires', (platform) => {
	const types = platformCommands(platform).map(({ name, input }) => [
		name,
		z.toJSONSchema(input, { io: 'input' }).type,
	]);
	expect(types.filter(([, type]) => type !== 'object')).toEqual([]);
});

test('the web app offers no window commands or file paths', () => {
	const web = platformCommands('web');
	expect(web.map(({ name }) => name).filter((name) => name.startsWith('window_'))).toEqual([]);
	expect(web.find(({ name }) => name === 'source_update')?.input.shape).not.toHaveProperty('path');
});
