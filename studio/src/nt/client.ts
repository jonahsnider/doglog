import type { NetworkTablesTypes } from '@ntcore-ts/client';

export type NtValue = NetworkTablesTypes;

export type NtTopic = { name: string; type: string; properties: Record<string, unknown> };

export type NtListener = {
	announce?: (topic: NtTopic) => void;
	unannounce?: (name: string) => void;
	/** Property changes, `null` values remove a property */
	properties?: (name: string, update: Record<string, unknown>) => void;
	/** `serverTime` is when the value changed, in microseconds on the server's clock */
	value?: (name: string, type: string, value: NtValue, serverTime: number) => void;
};

export type NtSubscribeOptions = { all?: boolean; periodic?: number };

/** NT4 types Studio can publish, by their NT4 type string */
export type NtPublishType =
	| 'raw'
	| 'string'
	| 'double'
	| 'float'
	| 'int'
	| 'boolean'
	| 'string[]'
	| 'double[]'
	| 'float[]'
	| 'int[]'
	| 'boolean[]';

/** A client of an NT4 server, which may share its connection with other clients */
export interface NtClient {
	isConnected(): boolean;
	/** The server's clock now (µs), synced when connecting. `undefined` while disconnected. */
	serverTime(): number | undefined;
	/** Called with the current state right after this returns, then whenever it changes. Returns a function that removes it. */
	onConnectedChange(listener: (connected: boolean) => void): () => void;
	/**
	 * Follow every topic whose name starts with `prefix`. Topics and values the connection already received are sent to
	 * `listener` first, like the server does for a new subscription. Returns a function that unsubscribes.
	 */
	subscribe(prefix: string, options: NtSubscribeOptions, listener: NtListener): () => void;
	/** Publish the topic `name`, resolving once the server accepts it */
	publish(name: string, type: NtPublishType): Promise<void>;
	/** Set a published topic's value, which must match the type it was published with */
	setValue(name: string, value: NtValue): void;
	unpublish(name: string): void;
	/** Unsubscribe and unpublish everything, disconnecting once no other client uses the connection */
	close(): void;
}

/**
 * Open a client of the NT4 server at `host`. Tabs and windows share one connection to each server through a shared
 * worker, so a robot isn't sent the same data once for each of them. Without shared workers, each has its own.
 */
export async function openNt(host: string): Promise<NtClient> {
	// The NT4 client is large, only load it where it's used
	if (typeof SharedWorker !== 'undefined' && 'locks' in navigator) {
		const { openSharedNt } = await import('@/nt/shared');
		return openSharedNt(host);
	}
	const { openLocalNt } = await import('@/nt/local');
	return openLocalNt(host);
}
