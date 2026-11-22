import type { NtClient, NtPublishType, NtValue } from '@/nt/client';

/** The live session's connection, set by `connectLive()` */
let connection: NtClient | undefined;

export function setLiveConnection(nt: NtClient | undefined): void {
	connection = nt;
}

/**
 * Send `value` to the topic `name` over the live session's connection, ex. to tune a value on the robot. The topic is
 * only published while sending, so a robot that restarts isn't sent the value again.
 */
export async function setLiveValue(name: string, type: NtPublishType, value: NtValue): Promise<void> {
	const nt = connection;
	if (nt?.isConnected() !== true) {
		throw new Error('Not connected to a robot');
	}
	await nt.publish(name, type);
	nt.setValue(name, value);
	nt.unpublish(name);
}
