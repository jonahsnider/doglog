export const accountKeySignatureAlgorithm = { name: 'ECDSA', hash: 'SHA-256' };

const attestationAlgorithm = { name: 'ECDSA', namedCurve: 'P-256' };

export async function attestationSigningKey(base64Pkcs8: string) {
	const pkcs8 = Uint8Array.from(atob(base64Pkcs8), (char) => char.charCodeAt(0));
	return crypto.subtle.importKey('pkcs8', pkcs8, attestationAlgorithm, true, ['sign']);
}

export async function attestationPublicKey(base64Pkcs8: string) {
	const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', await attestationSigningKey(base64Pkcs8));
	const publicKey = await crypto.subtle.importKey('jwk', { kty, crv, x, y }, attestationAlgorithm, true, ['verify']);
	return crypto.subtle.exportKey('spki', publicKey);
}

export function accountKeyMessage(accountId: string, publicKey: ArrayBuffer) {
	const header = new TextEncoder().encode(JSON.stringify(['doglog-account-key-v1', accountId]));
	const message = new Uint8Array(header.length + publicKey.byteLength);
	message.set(header);
	message.set(new Uint8Array(publicKey), header.length);
	return message;
}

export async function importAccountPublicKey(publicKey: ArrayBuffer) {
	if (publicKey.byteLength > 512) {
		throw new Error('Invalid account encryption key.');
	}
	const key = await crypto.subtle.importKey('spki', publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, [
		'encrypt',
	]);
	const { modulusLength, publicExponent } = key.algorithm as RsaHashedKeyAlgorithm;
	if (modulusLength !== 3072 || publicExponent.join(',') !== '1,0,1') {
		throw new Error('Invalid account encryption key.');
	}
	return key;
}
