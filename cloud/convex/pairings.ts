import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, type MutationCtx, query } from './_generated/server';

const pairingLifetime = 10 * 60 * 1000;

function checkLength(value: ArrayBuffer, length: number) {
	if (value.byteLength !== length) {
		throw new ConvexError('Invalid pairing message.');
	}
}

// Cloud only relays pairing messages. Studio verifies the other device itself, but each step is accepted once and in
// order so a pairing attempt can't be replayed or changed after a device has relied on it.
async function advance(
	ctx: MutationCtx,
	id: Id<'pairings'>,
	ready: (pairing: Doc<'pairings'>) => boolean,
	changes: Partial<Doc<'pairings'>>,
) {
	const userId = await getAuthUserId(ctx);
	const pairing = await ctx.db.get('pairings', id);
	if (!userId || pairing?.userId !== userId || pairing.expiresAt <= Date.now()) {
		throw new ConvexError('This pairing attempt ended.');
	}
	if (!ready(pairing)) {
		throw new ConvexError('This pairing attempt can’t continue from here. Start again on your new device.');
	}
	await ctx.db.patch('pairings', id, changes);
}

export const getMine = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		const pairing = userId
			? await ctx.db
					.query('pairings')
					.withIndex('by_user', (q) => q.eq('userId', userId))
					.unique()
			: null;
		return (
			pairing && {
				id: pairing._id,
				newDeviceKey: pairing.newDeviceKey,
				approverKey: pairing.approverKey,
				commitment: pairing.commitment,
				newDeviceNonce: pairing.newDeviceNonce,
				approverNonce: pairing.approverNonce,
				credential: pairing.credential,
			}
		);
	},
});

export const start = mutation({
	args: { publicKey: v.bytes() },
	handler: async (ctx, { publicKey }) => {
		const userId = await getAuthUserId(ctx);
		const user = userId ? await ctx.db.get('users', userId) : null;
		if (!user?.encryptionKey) {
			throw new ConvexError('Your account doesn’t have an encryption key to pair yet.');
		}
		checkLength(publicKey, 65);
		const previous = ctx.db.query('pairings').withIndex('by_user', (q) => q.eq('userId', user._id));
		for await (const pairing of previous) {
			await ctx.db.delete('pairings', pairing._id);
		}
		const expiresAt = Date.now() + pairingLifetime;
		const id = await ctx.db.insert('pairings', {
			userId: user._id,
			expiresAt,
			newDeviceKey: publicKey,
		});
		await ctx.scheduler.runAt(expiresAt, internal.pairings.expire, { id });
		return id;
	},
});

export const respond = mutation({
	args: { id: v.id('pairings'), publicKey: v.bytes(), commitment: v.bytes() },
	handler: async (ctx, { id, publicKey, commitment }) => {
		checkLength(publicKey, 65);
		checkLength(commitment, 32);
		await advance(ctx, id, (pairing) => !pairing.approverKey, {
			approverKey: publicKey,
			commitment,
		});
	},
});

export const revealNewDeviceNonce = mutation({
	args: { id: v.id('pairings'), nonce: v.bytes() },
	handler: async (ctx, { id, nonce }) => {
		checkLength(nonce, 16);
		await advance(ctx, id, (pairing) => !!pairing.approverKey && !pairing.newDeviceNonce, {
			newDeviceNonce: nonce,
		});
	},
});

export const revealApproverNonce = mutation({
	args: { id: v.id('pairings'), nonce: v.bytes() },
	handler: async (ctx, { id, nonce }) => {
		checkLength(nonce, 16);
		await advance(ctx, id, (pairing) => !!pairing.newDeviceNonce && !pairing.approverNonce, {
			approverNonce: nonce,
		});
	},
});

export const sendCredential = mutation({
	args: { id: v.id('pairings'), credential: v.object({ iv: v.bytes(), ciphertext: v.bytes() }) },
	handler: async (ctx, { id, credential }) => {
		checkLength(credential.iv, 12);
		if (credential.ciphertext.byteLength > 4096) {
			throw new ConvexError('Invalid pairing message.');
		}
		await advance(ctx, id, (pairing) => !!pairing.approverNonce && !pairing.credential, {
			credential,
		});
	},
});

export const cancel = mutation({
	args: { id: v.id('pairings') },
	handler: async (ctx, { id }) => {
		const userId = await getAuthUserId(ctx);
		const pairing = await ctx.db.get('pairings', id);
		if (userId && pairing?.userId === userId) {
			await ctx.db.delete('pairings', id);
		}
	},
});

export const expire = internalMutation({
	args: { id: v.id('pairings') },
	handler: async (ctx, { id }) => {
		if (await ctx.db.get('pairings', id)) {
			await ctx.db.delete('pairings', id);
		}
	},
});
