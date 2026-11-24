// Device pairing adapts Bluetooth Secure Simple Pairing's numeric comparison (Core spec, Vol 2 Part H, 7.2.1) to
// devices that talk through Cloud. The approver commits to its nonce before seeing the new device's nonce, so a relay
// that swaps in its own keys gets one guess at a matching six-digit code.

const label = new TextEncoder().encode('doglog-device-pairing-v1');
const ecdh = { name: 'ECDH', namedCurve: 'P-256' };

export interface PairingSession {
	userId: string;
	newDeviceKey: ArrayBuffer;
	approverKey: ArrayBuffer;
	newDeviceNonce: ArrayBuffer;
	approverNonce: ArrayBuffer;
}

// Every field has a fixed length, so concatenating them can't make two different sessions read the same.
function fixed(value: ArrayBuffer, length: number) {
	if (value.byteLength !== length) {
		throw new Error('Invalid pairing message.');
	}
	return new Uint8Array(value);
}

function concat(...parts: Uint8Array<ArrayBuffer>[]) {
	const bytes = new Uint8Array(parts.reduce((length, part) => length + part.byteLength, 0));
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.byteLength;
	}
	return bytes;
}

export async function createPairingKey() {
	const { privateKey, publicKey } = await crypto.subtle.generateKey(ecdh, false, ['deriveBits']);
	return { privateKey, publicKey: await crypto.subtle.exportKey('raw', publicKey) };
}

export function createNonce() {
	return crypto.getRandomValues(new Uint8Array(16)).buffer;
}

function commitmentKey(nonce: ArrayBuffer, usage: 'sign' | 'verify') {
	return crypto.subtle.importKey('raw', fixed(nonce, 16), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

function commitmentMessage(approverKey: ArrayBuffer, newDeviceKey: ArrayBuffer) {
	return concat(label, fixed(approverKey, 65), fixed(newDeviceKey, 65));
}

export async function commit(approverNonce: ArrayBuffer, approverKey: ArrayBuffer, newDeviceKey: ArrayBuffer) {
	return crypto.subtle.sign(
		'HMAC',
		await commitmentKey(approverNonce, 'sign'),
		commitmentMessage(approverKey, newDeviceKey),
	);
}

export async function verifyCommitment(commitment: ArrayBuffer, session: PairingSession) {
	return crypto.subtle.verify(
		'HMAC',
		await commitmentKey(session.approverNonce, 'verify'),
		commitment,
		commitmentMessage(session.approverKey, session.newDeviceKey),
	);
}

export async function verificationCode(session: PairingSession) {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		concat(
			label,
			fixed(session.newDeviceKey, 65),
			fixed(session.approverKey, 65),
			fixed(session.newDeviceNonce, 16),
			fixed(session.approverNonce, 16),
		),
	);
	return String(new DataView(digest).getUint32(28) % 1_000_000).padStart(6, '0');
}

async function transferKey(
	session: PairingSession,
	privateKey: CryptoKey,
	peerKey: ArrayBuffer,
	usage: 'encrypt' | 'decrypt',
) {
	const peer = await crypto.subtle.importKey('raw', fixed(peerKey, 65), ecdh, false, []);
	const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256);
	const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: concat(fixed(session.newDeviceNonce, 16), fixed(session.approverNonce, 16)),
			info: concat(
				label,
				fixed(session.newDeviceKey, 65),
				fixed(session.approverKey, 65),
				new TextEncoder().encode(session.userId),
			),
		},
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		[usage],
	);
}

export async function sealCredential(session: PairingSession, approverKey: CryptoKey, accountPrivateKey: ArrayBuffer) {
	const key = await transferKey(session, approverKey, session.newDeviceKey, 'encrypt');
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: label },
		key,
		accountPrivateKey,
	);
	return { iv: iv.buffer, ciphertext };
}

export async function openCredential(
	session: PairingSession,
	newDeviceKey: CryptoKey,
	credential: { iv: ArrayBuffer; ciphertext: ArrayBuffer },
) {
	const key = await transferKey(session, newDeviceKey, session.approverKey, 'decrypt');
	return crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: fixed(credential.iv, 12), additionalData: label },
		key,
		credential.ciphertext,
	);
}
