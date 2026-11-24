import type { Id } from '../../../cloud/convex/_generated/dataModel';

interface DashboardKeyContext {
	teamId: Id<'teams'>;
	dashboardId: string;
	keyVersion: number;
}

function encode(label: string, { teamId, dashboardId, keyVersion }: DashboardKeyContext) {
	return new TextEncoder().encode(JSON.stringify([label, teamId, dashboardId, keyVersion]));
}

/** A separate AES key for each dashboard and team key version, so a key can't decrypt another dashboard's updates */
export async function deriveDashboardKey(teamKey: ArrayBuffer, context: DashboardKeyContext) {
	const base = await crypto.subtle.importKey('raw', teamKey, 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: encode('doglog-dashboard-key-v1', context) },
		base,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	);
}

/** Encrypt a Loro update or snapshot, binding it to its dashboard and key version */
export async function encryptUpdate(key: CryptoKey, context: DashboardKeyContext, update: Uint8Array) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const additionalData = encode('doglog-dashboard-update-v1', context);
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, new Uint8Array(update));
	return { iv: iv.buffer, ciphertext };
}

export async function decryptUpdate(
	key: CryptoKey,
	context: DashboardKeyContext,
	{ iv, ciphertext }: { iv: ArrayBuffer; ciphertext: ArrayBuffer },
) {
	const additionalData = encode('doglog-dashboard-update-v1', context);
	return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData }, key, ciphertext));
}
