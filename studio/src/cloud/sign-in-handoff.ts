// The browser returns passkey responses and OAuth codes through a `doglog://sign-in` link. The result is encrypted
// to a key only the app that started the sign-in holds, so another app that receives the link can't use it.

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

/** The `doglog://sign-in` link that returns `result` to the app holding `appKey` */
export async function sealSignInResult(appKey: string, result: unknown) {
	const recipient = fromBase64Url(appKey);
	const { privateKey, publicKey } = await crypto.subtle.generateKey(ecdh, false, ['deriveBits']);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const data = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: recipient },
		await handoffKey(privateKey, recipient, 'encrypt'),
		new TextEncoder().encode(JSON.stringify(result)),
	);
	const url = new URL('doglog://sign-in');
	url.search = new URLSearchParams({
		key: toBase64Url(await crypto.subtle.exportKey('raw', publicKey)),
		iv: toBase64Url(iv.buffer),
		data: toBase64Url(data),
	}).toString();
	return url.href;
}

/** The result in a `doglog://sign-in` link. Throws if it wasn't encrypted to this key. */
export async function openSignInResult(link: string, privateKey: CryptoKey, publicKey: Uint8Array<ArrayBuffer>) {
	const params = new URL(link).searchParams;
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: fromBase64Url(params.get('iv') ?? ''), additionalData: publicKey },
		await handoffKey(privateKey, fromBase64Url(params.get('key') ?? ''), 'decrypt'),
		fromBase64Url(params.get('data') ?? ''),
	);
	return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
}
