import { accountKeyMessage, accountKeySignatureAlgorithm, importAccountPublicKey } from '../../../cloud/account-key';
import type { Id } from '../../../cloud/convex/_generated/dataModel';

interface TeamKeyContext {
	teamId: Id<'teams'>;
	recipientId: Id<'users'>;
	keyVersion: number;
}

function wrappingOptions({ teamId, recipientId, keyVersion }: TeamKeyContext) {
	if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
		throw new Error('Invalid team key version.');
	}
	return {
		name: 'RSA-OAEP',
		label: new TextEncoder().encode(JSON.stringify(['doglog-team-key-grant-v1', teamId, recipientId, keyVersion])),
	};
}

// The trusted Cloud public key comes from Studio configuration, never from the grant.
export async function wrapTeamKey(
	teamKey: ArrayBuffer,
	context: TeamKeyContext,
	recipient: { publicKey: ArrayBuffer; signature: ArrayBuffer },
	trustedCloudPublicKey: ArrayBuffer,
) {
	if (teamKey.byteLength !== 32) {
		throw new Error('Invalid team key.');
	}
	const options = wrappingOptions(context);
	const publicKey = recipient.publicKey.slice(0);
	const message = accountKeyMessage(context.recipientId, publicKey);
	const verificationKey = await crypto.subtle.importKey(
		'spki',
		trustedCloudPublicKey,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['verify'],
	);
	if (!(await crypto.subtle.verify(accountKeySignatureAlgorithm, verificationKey, recipient.signature, message))) {
		throw new Error('Invalid account key attestation.');
	}
	return crypto.subtle.encrypt(options, await importAccountPublicKey(publicKey), teamKey);
}

export function createTeamKey() {
	return crypto.getRandomValues(new Uint8Array(32)).buffer;
}

// The OAEP label binds the context but does not identify the sender. The recipient relies on Cloud only accepting
// grants from members who hold the current key.
export async function unwrapTeamKey(wrappedKey: ArrayBuffer, context: TeamKeyContext, accountPrivateKey: CryptoKey) {
	const teamKey = await crypto.subtle.decrypt(wrappingOptions(context), accountPrivateKey, wrappedKey);
	if (teamKey.byteLength !== 32) {
		throw new Error('Invalid team key.');
	}
	return teamKey;
}
