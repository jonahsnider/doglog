// The browser returns passkey responses and OAuth codes through a `doglog://sign-in` link, or a code the user pastes
// into the app when the link doesn't open it. The result is encrypted to a key only the app that started the sign-in
// holds, so another app that receives the link can't use it.

const ecdh = { name: 'ECDH', namedCurve: 'P-256' };
const info = new TextEncoder().encode('doglog-desktop-sign-in-v1');

function toBase64Url(bytes: ArrayBuffer) {
	return btoa(String.fromCodePoint(...new Uint8Array(bytes)))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/u, '');
}

function fromBase64Url(text: string) {
	return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.codePointAt(0) ?? 0);
}

async function handoffKey(privateKey: CryptoKey, publicKey: Uint8Array<ArrayBuffer>, usage: 'encrypt' | 'decrypt') {
	const shared = await crypto.subtle.deriveBits(
		{ name: 'ECDH', public: await crypto.subtle.importKey('raw', publicKey, ecdh, false, []) },
		privateKey,
		256,
	);
	const hkdf = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info },
		hkdf,
		{ name: 'AES-GCM', length: 256 },
		false,
		[usage],
	);
}

/** A key for one sign-in. The browser gets `encoded` and encrypts its result to it. */
export async function createHandoffKey() {
	const { privateKey, publicKey } = await crypto.subtle.generateKey(ecdh, false, ['deriveBits']);
	const raw = await crypto.subtle.exportKey('raw', publicKey);
	return { privateKey, publicKey: new Uint8Array(raw), encoded: toBase64Url(raw) };
}

// A code is the browser's public key, the IV, then the ciphertext
const publicKeyLength = 65;
const ivLength = 12;

/** The code that returns `result` to the app holding `appKey`, which the user pastes if the link doesn't open the app */
export async function sealSignInResult(appKey: string, result: unknown) {
	const recipient = fromBase64Url(appKey);
	const { privateKey, publicKey } = await crypto.subtle.generateKey(ecdh, false, ['deriveBits']);
	const iv = crypto.getRandomValues(new Uint8Array(ivLength));
	const data = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: recipient },
		await handoffKey(privateKey, recipient, 'encrypt'),
		new TextEncoder().encode(JSON.stringify(result)),
	);
	const code = new Uint8Array(publicKeyLength + ivLength + data.byteLength);
	code.set(new Uint8Array(await crypto.subtle.exportKey('raw', publicKey)));
	code.set(iv, publicKeyLength);
	code.set(new Uint8Array(data), publicKeyLength + ivLength);
	return toBase64Url(code.buffer);
}

/** The `doglog://sign-in` link that opens the app with `code` */
export function signInLink(code: string) {
	return `doglog://sign-in?${new URLSearchParams({ code })}`;
}

/** The code in a `doglog://sign-in` link */
export function codeFromLink(link: string) {
	return new URL(link).searchParams.get('code') ?? '';
}

/** The result in a code. Throws if it wasn't encrypted to this key. */
export async function openSignInResult(code: string, privateKey: CryptoKey, publicKey: Uint8Array<ArrayBuffer>) {
	const bytes = fromBase64Url(code.trim());
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: bytes.subarray(publicKeyLength, publicKeyLength + ivLength), additionalData: publicKey },
		await handoffKey(privateKey, bytes.slice(0, publicKeyLength), 'decrypt'),
		bytes.subarray(publicKeyLength + ivLength),
	);
	return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
}
