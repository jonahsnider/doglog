import * as z from 'zod';

export type SharedMap<T> = {
	get(key: string): T | undefined;
	set(key: string, value: T): void;
};

/**
 * Create a map that's kept the same in every open tab and window, for state that should last until Studio closes.
 * Windows opened later start with the entries from the ones already open.
 * Received values are validated with `schema`, since tabs left open on an older version of Studio could send a different shape.
 */
export function createSharedMap<T>(name: string, schema: z.ZodType<T>): SharedMap<T> {
	const map = new Map<string, T>();
	// A request asks the open windows for their entries, otherwise a message has entries to take
	const messageSchema = z.union([
		z.object({ request: z.literal(true) }),
		z.object({ entries: z.array(z.tuple([z.string(), schema])) }),
	]);
	const channel = new BroadcastChannel(`doglog-studio:${name}`);

	function post(message: z.infer<typeof messageSchema>): void {
		// oxlint-disable-next-line unicorn/require-post-message-target-origin -- Broadcast channels don't take a target origin
		channel.postMessage(message);
	}

	channel.addEventListener('message', (event) => {
		const message = messageSchema.safeParse(event.data);
		if (!message.success) {
			return;
		}

		if ('request' in message.data) {
			post({ entries: [...map] });
		} else {
			for (const [key, value] of message.data.entries) {
				map.set(key, value);
			}
		}
	});
	post({ request: true });

	return {
		get: (key) => map.get(key),
		set: (key, value) => {
			map.set(key, value);
			post({ entries: [[key, value]] });
		},
	};
}
