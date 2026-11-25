import { vAppleProfile } from '@convex-dev/auth/methods/apple/server';
import { vGoogleProfile } from '@convex-dev/auth/methods/google/server';
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
import type { Doc } from './_generated/dataModel';
import { action, env, internalMutation, type MutationCtx, mutation, type QueryCtx, query } from './_generated/server';
import { getMembership } from './teams';

export function normalizeDisplayName(value: string) {
	const name = value.trim();
	if (name.length === 0 || name.length > 80) {
		throw new ConvexError('Enter a display name between 1 and 80 characters.');
	}
	return name;
}

export const createWithPasskey = internalMutation({
	args: {
		method: v.object({ name: v.literal('passkey'), profile: v.object({ displayName: v.optional(v.string()) }) }),
	},
	returns: v.id('users'),
	handler: (ctx, { method }) => ctx.db.insert('users', { displayName: method.profile.displayName }),
});

// Called for an identity Apple or Google hasn't signed in before. Returns the account linking it, see `finishLinking`.
async function createOrLink(ctx: MutationCtx, provider: { apple: true } | { google: true }) {
	const link = await ctx.db
		.query('oauthLinks')
		.withIndex('by_finishing', (q) => q.eq('finishing', true))
		.unique();
	return link?.userId ?? (await ctx.db.insert('users', provider));
}

// Cloud doesn't need the email or name Apple shares, so they aren't stored
export const createWithApple = internalMutation({
	args: { method: v.object({ name: v.literal('apple'), profile: vAppleProfile }) },
	returns: v.id('users'),
	handler: (ctx) => createOrLink(ctx, { apple: true }),
});

export const createWithGoogle = internalMutation({
	args: { method: v.object({ name: v.literal('google'), profile: vGoogleProfile }) },
	returns: v.id('users'),
	handler: (ctx) => createOrLink(ctx, { google: true }),
});

export const getCurrent = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		const user = userId ? await ctx.db.get('users', userId) : null;
		return user ? { id: user._id, displayName: user.displayName ?? null } : null;
	},
});

async function listSignInMethods(ctx: QueryCtx, user: Doc<'users'>) {
	const passkeys = await ctx.runQuery(components.authPasskey.registration.listPasskeys, { userId: user._id });
	return {
		passkeys: passkeys.map(({ passkeyId, name }) => ({ id: passkeyId, name: name ?? null })),
		apple: user.apple === true,
		google: user.google === true,
	};
}

/** Throws unless the account can still sign in without the method being removed */
async function requireOtherSignInMethod(ctx: MutationCtx) {
	const userId = await getAuthUserId(ctx);
	const user = userId ? await ctx.db.get('users', userId) : null;
	if (!user) {
		throw new ConvexError('Sign in to remove a way to sign in.');
	}
	const methods = await listSignInMethods(ctx, user);
	if (methods.passkeys.length + Number(methods.apple) + Number(methods.google) <= 1) {
		throw new ConvexError('Add another way to sign in before removing this one.');
	}
	return user._id;
}

export const getSignInMethods = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		const user = userId ? await ctx.db.get('users', userId) : null;
		return user ? listSignInMethods(ctx, user) : null;
	},
});

export const removePasskey = mutation({
	args: { passkeyId: v.string() },
	handler: async (ctx, { passkeyId }) => {
		const userId = await requireOtherSignInMethod(ctx);
		const removed = await ctx.runMutation(components.authPasskey.registration.deletePasskey, { userId, passkeyId });
		if (!removed.success) {
			throw new ConvexError('That passkey was already removed.');
		}
	},
});

export const unlink = mutation({
	args: { provider: v.union(v.literal('apple'), v.literal('google')) },
	handler: async (ctx, { provider }) => {
		const userId = await requireOtherSignInMethod(ctx);
		const user = await ctx.db.get('users', userId);
		if (!user?.[provider]) {
			throw new ConvexError(`${provider === 'apple' ? 'Apple' : 'Google'} is already unlinked.`);
		}
		// Removes every identity from that provider linked to the account
		const component = provider === 'apple' ? components.authApple : components.authGoogle;
		await ctx.runMutation(component.provider.deleteUser, { userId });
		await ctx.db.patch('users', userId, { [provider]: undefined });
	},
});

export const setDisplayName = mutation({
	args: { displayName: v.string() },
	handler: async (ctx, { displayName }) => {
		const userId = await getAuthUserId(ctx);
		if (!userId || !(await ctx.db.get('users', userId))) {
			throw new ConvexError('Sign in to change your display name.');
		}
		await ctx.db.patch('users', userId, { displayName: normalizeDisplayName(displayName) });
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
		await ctx.runMutation(components.authApple.provider.deleteUser, { userId });
		await ctx.runMutation(components.authGoogle.provider.deleteUser, { userId });
		const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId });
		await ctx.runMutation(components.auth.public.revokeSessions, {
			sessionIds: sessions.map((session) => session.sessionId),
		});

		const pendingJoins = ctx.db.query('pendingJoins').withIndex('by_user_and_invite', (q) => q.eq('userId', userId));
		for await (const pending of pendingJoins) {
			await ctx.db.delete('pendingJoins', pending._id);
		}
		const links = ctx.db.query('oauthLinks').withIndex('by_user', (q) => q.eq('userId', userId));
		for await (const link of links) {
			await ctx.db.delete('oauthLinks', link._id);
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
