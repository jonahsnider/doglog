import type { ConvexReactClient } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { api } from '../../../cloud/convex/_generated/api.js';
import type { Id } from '../../../cloud/convex/_generated/dataModel';
import { exportAccountKey, saveAccountKey } from './account-key';
import {
	commit,
	createNonce,
	createPairingKey,
	openCredential,
	sealCredential,
	verificationCode,
	verifyCommitment,
} from './pairing';

export interface PairingAccount {
	deployment: string;
	userId: Id<'users'>;
	publicKey: ArrayBuffer;
}

export type PairingRequest = NonNullable<FunctionReturnType<typeof api.pairings.getMine>>;

export function errorMessage(error: unknown, fallback: string) {
	return error instanceof ConvexError && typeof error.data === 'string' ? error.data : fallback;
}

export async function cancelPairing(client: ConvexReactClient, id: Id<'pairings'>) {
	try {
		await client.mutation(api.pairings.cancel, { id });
	} catch {
		// The attempt expires on its own
	}
}

// Resolves once the pairing has the next message, and rejects if the attempt ends first.
function waitFor<T>(
	client: ConvexReactClient,
	id: Id<'pairings'>,
	select: (pairing: PairingRequest) => T | undefined,
	signal: AbortSignal,
) {
	return new Promise<T>((resolve, reject) => {
		signal.throwIfAborted();
		const watch = client.watchQuery(api.pairings.getMine, {});
		let settled = false;
		function settle(finish: () => void) {
			settled = true;
			// Deferred so the subscription exists even if the first update arrives while subscribing
			queueMicrotask(() => unsubscribe());
			signal.removeEventListener('abort', abort);
			finish();
		}
		function abort() {
			settle(() => reject(new Error('Pairing was cancelled.')));
		}
		function check() {
			if (settled) {
				return;
			}
			try {
				const pairing = watch.localQueryResult();
				if (pairing === undefined) {
					return;
				}
				if (pairing?.id !== id) {
					settle(() => reject(new ConvexError('This pairing attempt ended.')));
					return;
				}
				const value = select(pairing);
				if (value !== undefined) {
					settle(() => resolve(value));
				}
			} catch (error) {
				settle(() => reject(error instanceof Error ? error : new Error(String(error))));
			}
		}
		signal.addEventListener('abort', abort);
		const unsubscribe = watch.onUpdate(check);
		check();
	});
}

export async function pairNewDevice(
	client: ConvexReactClient,
	account: PairingAccount,
	signal: AbortSignal,
	showCode: (code: string) => void,
) {
	const own = await createPairingKey();
	const id = await client.mutation(api.pairings.start, { publicKey: own.publicKey });
	try {
		const approver = await waitFor(
			client,
			id,
			({ approverKey, commitment }) => (approverKey && commitment ? { approverKey, commitment } : undefined),
			signal,
		);
		// Revealed only after the approver committed to its nonce
		const newDeviceNonce = createNonce();
		await client.mutation(api.pairings.revealNewDeviceNonce, { id, nonce: newDeviceNonce });
		const approverNonce = await waitFor(client, id, (pairing) => pairing.approverNonce, signal);
		const session = {
			userId: account.userId,
			newDeviceKey: own.publicKey,
			approverKey: approver.approverKey,
			newDeviceNonce,
			approverNonce,
		};
		if (!(await verifyCommitment(approver.commitment, session))) {
			throw new ConvexError('Your devices couldn’t verify each other. Start again on this device.');
		}
		showCode(await verificationCode(session));
		const credential = await waitFor(client, id, (pairing) => pairing.credential, signal);
		const privateKey = await openCredential(session, own.privateKey, credential);
		await saveAccountKey(account.deployment, account.userId, account.publicKey, privateKey);
	} finally {
		await cancelPairing(client, id);
	}
}

export async function startApproval(
	client: ConvexReactClient,
	account: PairingAccount,
	request: PairingRequest,
	signal: AbortSignal,
) {
	const own = await createPairingKey();
	const approverNonce = createNonce();
	const { id } = request;
	const commitment = await commit(approverNonce, own.publicKey, request.newDeviceKey);
	await client.mutation(api.pairings.respond, { id, publicKey: own.publicKey, commitment });
	try {
		// Revealed only after the new device's nonce is fixed
		const newDeviceNonce = await waitFor(client, id, (pairing) => pairing.newDeviceNonce, signal);
		await client.mutation(api.pairings.revealApproverNonce, { id, nonce: approverNonce });
		const session = {
			userId: account.userId,
			newDeviceKey: request.newDeviceKey,
			approverKey: own.publicKey,
			newDeviceNonce,
			approverNonce,
		};
		return {
			code: await verificationCode(session),
			confirm: async () => {
				const privateKey = await exportAccountKey(account.deployment, account.userId, account.publicKey);
				const credential = await sealCredential(session, own.privateKey, privateKey);
				await client.mutation(api.pairings.sendCredential, { id, credential });
			},
		};
	} catch (error) {
		await cancelPairing(client, id);
		throw error;
	}
}
