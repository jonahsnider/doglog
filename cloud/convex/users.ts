import { vAppleProfile } from '@convex-dev/auth/methods/apple/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import {
	accountKeyMessage,
	accountKeySignatureAlgorithm,
	attestationPublicKey,
	attestationSigningKey,
	importAccountPublicKey,
} from '../account-key';
import { api, components, internal } from './_generated/api';
import { action, env, internalMutation, mutation, query } from './_generated/server';
import { getMembership } from './teams';

export const create = internalMutation({
	args: { method: v.object({ name: v.literal('usernamePasskey'), profile: v.object({}) }) },
	returns: v.id('users'),
	handler: (ctx) => ctx.db.insert('users', {}),
});

// Cloud doesn't need the email or name Apple shares, so they aren't stored
export const createWithApple = internalMutation({
	args: { method: v.object({ name: v.literal('apple'), profile: vAppleProfile }) },
	returns: v.id('users'),
	handler: (ctx) => ctx.db.insert('users', {}),
});

export const getCurrent = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		const user = userId ? await ctx.db.get('users', userId) : null;
		return user ? { id: user._id } : null;
	},
});

export const remove = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId || !(await ctx.db.get('users', userId))) {
			throw new ConvexError('Sign in to delete your Cloud account.');
		}
		if (await getMembership(ctx.db, userId)) {
			throw new ConvexError('You can only delete your Cloud account when you don’t belong to a team.');
		}

		await ctx.runMutation(components.authPasskey.registration.deleteUser, { userId });
		await ctx.runMutation(components.authUsername.public.deleteUsername, { userId });
		await ctx.runMutation(components.authApple.provider.deleteUser, { userId });
		const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId });
		await ctx.runMutation(components.auth.public.revokeSessions, {
			sessionIds: sessions.map((session) => session.sessionId),
		});

		const pendingJoins = ctx.db.query('pendingJoins').withIndex('by_user_and_invite', (q) => q.eq('userId', userId));
		for await (const pending of pendingJoins) {
			await ctx.db.delete('pendingJoins', pending._id);
		}
		const pairings = ctx.db.query('pairings').withIndex('by_user', (q) => q.eq('userId', userId));
		for await (const pairing of pairings) {
			await ctx.db.delete('pairings', pairing._id);
		}
		await ctx.db.delete('users', userId);
	},
});

export const getMyEncryptionKey = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		const user = userId ? await ctx.db.get('users', userId) : null;
		return user?.encryptionKey ?? null;
	},
});

// Derived from the deployment's signing key, not stored data, so a changed database can't vouch for a substituted key.
export const getAttestationKey = query({
	args: {},
	handler: () => (env.ATTESTATION_PRIVATE_KEY ? attestationPublicKey(env.ATTESTATION_PRIVATE_KEY) : null),
});

export const registerEncryptionKey = action({
	args: { userId: v.id('users'), publicKey: v.bytes() },
	handler: async (ctx, { userId, publicKey }): Promise<{ publicKey: ArrayBuffer; signature: ArrayBuffer }> => {
		const user = await ctx.runQuery(api.users.getCurrent);
		if (user?.id !== userId) {
			throw new ConvexError('Sign in to register an account encryption key.');
		}
		try {
			await importAccountPublicKey(publicKey);
		} catch {
			throw new ConvexError('Invalid account encryption key.');
		}
		if (!env.ATTESTATION_PRIVATE_KEY) {
			throw new ConvexError('Account encryption key registration is unavailable.');
		}
		const signature = await crypto.subtle.sign(
			accountKeySignatureAlgorithm,
			await attestationSigningKey(env.ATTESTATION_PRIVATE_KEY),
			accountKeyMessage(user.id, publicKey),
		);
		return ctx.runMutation(internal.users.storeFirstEncryptionKey, {
			userId: user.id,
			encryptionKey: { publicKey, signature },
		});
	},
});

export const storeFirstEncryptionKey = internalMutation({
	args: {
		userId: v.id('users'),
		encryptionKey: v.object({ publicKey: v.bytes(), signature: v.bytes() }),
	},
	handler: async (ctx, { userId, encryptionKey }) => {
		const user = (await getAuthUserId(ctx)) === userId ? await ctx.db.get('users', userId) : null;
		if (!user) {
			throw new ConvexError('Sign in to register an account encryption key.');
		}
		if (user.encryptionKey) {
			const stored = new Uint8Array(user.encryptionKey.publicKey);
			const submitted = new Uint8Array(encryptionKey.publicKey);
			if (stored.length === submitted.length && stored.every((byte, i) => byte === submitted[i])) {
				return user.encryptionKey;
			}
			throw new ConvexError('This account already has an encryption key.');
		}
		await ctx.db.patch('users', userId, { encryptionKey });
		return encryptionKey;
	},
});
