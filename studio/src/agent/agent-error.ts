/** A command failed in a way the agent can fix or explain to the user, its message is meant for the agent */
export class AgentError extends Error {
	/** Whether the command's input didn't match its schema, as opposed to the command failing */
	readonly invalidInput: boolean;

	constructor(message: string, { invalidInput = false }: { invalidInput?: boolean } = {}) {
		super(message);
		this.name = 'AgentError';
		this.invalidInput = invalidInput;
	}
}
