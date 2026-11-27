// The storage connection is encrypted with a key derived from the team key, so Cloud can't read its credentials
import { type StorageConnection, connectionSchema } from '@/storage/connection';

interface ConnectionKeyContext {
	teamId: string;
	keyVersion: number;
}

function encode(label: string, { teamId, keyVersion }: ConnectionKeyContext) {
	return new TextEncoder().encode(JSON.stringify([label, teamId, keyVersion]));
}

async function deriveKey(teamKey: ArrayBuffer, context: ConnectionKeyContext) {
	const base = await crypto.subtle.importKey('raw', teamKey, 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: new Uint8Array(32),
			info: encode('doglog-storage-connection-key-v1', context),
		},
		base,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	);
}

export async function encryptConnection(
	teamKey: ArrayBuffer,
	context: ConnectionKeyContext,
	connection: StorageConnection,
): Promise<{ iv: ArrayBuffer; ciphertext: ArrayBuffer }> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: encode('doglog-storage-connection-v1', context) },
		await deriveKey(teamKey, context),
		new TextEncoder().encode(JSON.stringify(connection)),
	);
	return { iv: iv.buffer, ciphertext };
}

export async function decryptConnection(
	teamKey: ArrayBuffer,
	context: ConnectionKeyContext,
	{ iv, ciphertext }: { iv: ArrayBuffer; ciphertext: ArrayBuffer },
): Promise<StorageConnection> {
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv, additionalData: encode('doglog-storage-connection-v1', context) },
		await deriveKey(teamKey, context),
		ciphertext,
	);
	return connectionSchema.parse(JSON.parse(new TextDecoder().decode(plaintext)));
}
