import { expect, test } from 'vite-plus/test';
import {
	commit,
	createNonce,
	createPairingKey,
	openCredential,
	sealCredential,
	verificationCode,
	verifyCommitment,
} from '@/cloud/pairing';

const accountKey = new TextEncoder().encode('account private key').buffer;
const fill = (length: number, value: number) => new Uint8Array(length).fill(value).buffer;

async function devices() {
	const [newDevice, approver, relay] = await Promise.all([createPairingKey(), createPairingKey(), createPairingKey()]);
	const session = {
		userId: 'user',
		newDeviceKey: newDevice.publicKey,
		approverKey: approver.publicKey,
		newDeviceNonce: createNonce(),
		approverNonce: createNonce(),
	};
	return { newDevice, approver, relay, session };
}

test('an honest pairing verifies the commitment and delivers the account key', async () => {
	const { newDevice, approver, session } = await devices();
	const commitment = await commit(session.approverNonce, approver.publicKey, newDevice.publicKey);
	await expect(verifyCommitment(commitment, session)).resolves.toBe(true);
	await expect(verificationCode(session)).resolves.toMatch(/^\d{6}$/u);
	const sealed = await sealCredential(session, approver.privateKey, accountKey);
	await expect(openCredential(session, newDevice.privateKey, sealed)).resolves.toEqual(accountKey);
});

test('a relay that substitutes its own key fails the commitment and cannot read the account key', async () => {
	const { newDevice, approver, relay, session } = await devices();
	// The approver committed to the key it saw, so showing the new device another approver key fails
	const commitment = await commit(session.approverNonce, approver.publicKey, newDevice.publicKey);
	await expect(verifyCommitment(commitment, { ...session, approverKey: relay.publicKey })).resolves.toBe(false);
	// An approver that was shown the relay's key commits to that key instead of the new device's
	const misled = await commit(session.approverNonce, approver.publicKey, relay.publicKey);
	await expect(verifyCommitment(misled, session)).resolves.toBe(false);
	await expect(verifyCommitment(commitment, { ...session, approverNonce: createNonce() })).resolves.toBe(false);

	const sealed = await sealCredential(session, approver.privateKey, accountKey);
	await expect(openCredential(session, relay.privateKey, sealed)).rejects.toHaveProperty('name', 'OperationError');
	const toRelay = await sealCredential({ ...session, newDeviceKey: relay.publicKey }, approver.privateKey, accountKey);
	await expect(openCredential(session, newDevice.privateKey, toRelay)).rejects.toHaveProperty('name', 'OperationError');
});

test('the code changes with either key, either nonce, or swapped roles', async () => {
	const session = {
		userId: 'user',
		newDeviceKey: fill(65, 1),
		approverKey: fill(65, 2),
		newDeviceNonce: fill(16, 3),
		approverNonce: fill(16, 4),
	};
	const code = await verificationCode(session);
	const fields = ['newDeviceKey', 'approverKey', 'newDeviceNonce', 'approverNonce'] as const;
	const changed = await Promise.all(
		fields.map((field) => verificationCode({ ...session, [field]: fill(session[field].byteLength, 9) })),
	);
	expect(changed).not.toContain(code);
	await expect(
		verificationCode({
			...session,
			newDeviceKey: session.approverKey,
			approverKey: session.newDeviceKey,
		}),
	).resolves.not.toBe(code);
});
