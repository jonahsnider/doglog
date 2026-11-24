import { get, set, update } from 'idb-keyval';

const accountKeyAlgorithm = { name: 'RSA-OAEP', hash: 'SHA-256' };

interface StoredAccountKey {
	publicKey: ArrayBuffer;
	wrappedPrivateKey: ArrayBuffer;
	wrappingKey: CryptoKey;
	iv: Uint8Array<ArrayBuffer>;
}

function storage(deployment: string, userId: string) {
	const key = JSON.stringify(['doglog-cloud-account-key-v1', deployment, userId]);
	return { key, additionalData: new TextEncoder().encode(key) };
}

function sameBytes(a: ArrayBuffer, b: ArrayBuffer) {
	const left = new Uint8Array(a);
	const right = new Uint8Array(b);
	return left.length === right.length && left.every((byte, i) => byte === right[i]);
}

async function seal(
	privateKey: CryptoKey,
	publicKey: ArrayBuffer,
	additionalData: Uint8Array<ArrayBuffer>,
): Promise<StoredAccountKey> {
	const wrappingKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
		'wrapKey',
		'unwrapKey',
	]);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const wrappedPrivateKey = await crypto.subtle.wrapKey('pkcs8', privateKey, wrappingKey, {
		name: 'AES-GCM',
		iv,
		additionalData,
	});
	return { publicKey, wrappedPrivateKey, wrappingKey, iv };
}

function unseal(stored: StoredAccountKey, additionalData: Uint8Array<ArrayBuffer>, extractable: boolean) {
	return crypto.subtle.unwrapKey(
		'pkcs8',
		stored.wrappedPrivateKey,
		stored.wrappingKey,
		{ name: 'AES-GCM', iv: stored.iv, additionalData },
		accountKeyAlgorithm,
		extractable,
		['decrypt'],
	);
}

export async function unlockAccountKey(
	deployment: string,
	userId: string,
	registeredPublicKey: ArrayBuffer | null,
	register: (publicKey: ArrayBuffer) => Promise<unknown>,
) {
	const { key, additionalData } = storage(deployment, userId);
	let stored = await get<StoredAccountKey>(key);
	if (!stored && registeredPublicKey === null) {
		const accountKey = await crypto.subtle.generateKey(
			{ ...accountKeyAlgorithm, modulusLength: 3072, publicExponent: Uint8Array.of(1, 0, 1) },
			true,
			['encrypt', 'decrypt'],
		);
		const candidate = await seal(
			accountKey.privateKey,
			await crypto.subtle.exportKey('spki', accountKey.publicKey),
			additionalData,
		);
		// Commit one candidate across tabs before registering its public key with Cloud.
		await update<StoredAccountKey>(key, (existing) => existing ?? candidate);
		stored = await get<StoredAccountKey>(key);
	}
	if (!stored || (registeredPublicKey !== null && !sameBytes(stored.publicKey, registeredPublicKey))) {
		return null;
	}
	const privateKey = await unseal(stored, additionalData, false);
	if (registeredPublicKey === null) {
		await register(stored.publicKey);
	}
	return privateKey;
}

// Pairing is the only reason to read the private key out of storage.
export async function exportAccountKey(deployment: string, userId: string, registeredPublicKey: ArrayBuffer) {
	const { key, additionalData } = storage(deployment, userId);
	const stored = await get<StoredAccountKey>(key);
	if (!stored || !sameBytes(stored.publicKey, registeredPublicKey)) {
		throw new Error('This browser doesn’t have your account’s encryption key.');
	}
	return crypto.subtle.exportKey('pkcs8', await unseal(stored, additionalData, true));
}

export async function saveAccountKey(
	deployment: string,
	userId: string,
	registeredPublicKey: ArrayBuffer,
	pkcs8: ArrayBuffer,
) {
	const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, accountKeyAlgorithm, true, ['decrypt']);
	const { n, e } = await crypto.subtle.exportKey('jwk', privateKey);
	const publicKey = await crypto.subtle.importKey('jwk', { kty: 'RSA', n, e }, accountKeyAlgorithm, true, ['encrypt']);
	if (!sameBytes(await crypto.subtle.exportKey('spki', publicKey), registeredPublicKey)) {
		throw new Error('The paired key doesn’t belong to this account.');
	}
	const { key, additionalData } = storage(deployment, userId);
	await set(key, await seal(privateKey, registeredPublicKey, additionalData));
}
