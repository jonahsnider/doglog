import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { type DatabaseReader, mutation, type MutationCtx, query, type QueryCtx } from './_generated/server';
import { getMembership } from './teams';

// A connection is a few hundred bytes of JSON, a private key for SFTP a few KB
const maxCiphertextLength = 64_000;

async function getCaller(ctx: QueryCtx) {
	const userId = await getAuthUserId(ctx);
	const membership = userId ? await getMembership(ctx.db, userId) : null;
	const team = membership ? await ctx.db.get('teams', membership.teamId) : null;
	return membership && team ? { membership, team } : null;
}

function getConnection(db: DatabaseReader, teamId: Id<'teams'>) {
	return db
		.query('storageConnections')
		.withIndex('by_team', (q) => q.eq('teamId', teamId))
		.unique();
}

// Only a member holding the current team key can encrypt a connection every member can read
async function requireCurrentKey(
	ctx: MutationCtx,
	{ membership, team }: { membership: Doc<'memberships'>; team: Doc<'teams'> },
	keyVersion: number,
) {
	const grant =
		team.keyVersion === undefined
			? null
			: await ctx.db
					.query('teamKeys')
					.withIndex('by_team_user_and_version', (q) =>
						q.eq('teamId', team._id).eq('userId', membership.userId).eq('keyVersion', keyVersion),
					)
					.unique();
	if (team.keyVersion !== keyVersion || team.rotationPending || !grant) {
		throw new ConvexError('The team key changed. Try again.');
	}
}

function checkCiphertext(iv: ArrayBuffer, ciphertext: ArrayBuffer) {
	if (iv.byteLength !== 12 || ciphertext.byteLength === 0 || ciphertext.byteLength > maxCiphertextLength) {
		throw new ConvexError('Invalid storage connection.');
	}
}

/** The team's encrypted storage connection, `null` without one or outside a team */
export const get = query({
	args: {},
	handler: async (ctx) => {
		const caller = await getCaller(ctx);
		const connection = caller ? await getConnection(ctx.db, caller.team._id) : null;
		return connection && { keyVersion: connection.keyVersion, iv: connection.iv, ciphertext: connection.ciphertext };
	},
});

/** Set up or replace the team's storage connection. Admins only. */
export const save = mutation({
	args: { keyVersion: v.number(), iv: v.bytes(), ciphertext: v.bytes() },
	handler: async (ctx, { keyVersion, iv, ciphertext }) => {
		const caller = await getCaller(ctx);
		if (caller?.membership.role !== 'admin') {
			throw new ConvexError('Only team admins can change the team’s storage.');
		}
		checkCiphertext(iv, ciphertext);
		await requireCurrentKey(ctx, caller, keyVersion);
		const existing = await getConnection(ctx.db, caller.team._id);
		if (existing) {
			await ctx.db.patch('storageConnections', existing._id, { keyVersion, iv, ciphertext });
		} else {
			await ctx.db.insert('storageConnections', { teamId: caller.team._id, keyVersion, iv, ciphertext });
		}
	},
});

/**
 * Re-encrypt the connection with the current team key after a rotation. Any member holding the current key can, since
 * it doesn't change the connection, and only a connection encrypted with an older key is replaced.
 */
export const reencrypt = mutation({
	args: { fromKeyVersion: v.number(), keyVersion: v.number(), iv: v.bytes(), ciphertext: v.bytes() },
	handler: async (ctx, { fromKeyVersion, keyVersion, iv, ciphertext }) => {
		const caller = await getCaller(ctx);
		if (!caller) {
			throw new ConvexError('You’re not on a team.');
		}
		checkCiphertext(iv, ciphertext);
		await requireCurrentKey(ctx, caller, keyVersion);
		const existing = await getConnection(ctx.db, caller.team._id);
		if (existing?.keyVersion !== fromKeyVersion || fromKeyVersion >= keyVersion) {
			return;
		}
		await ctx.db.patch('storageConnections', existing._id, { keyVersion, iv, ciphertext });
	},
});

/** Disconnect the team's storage, which doesn't change anything in the storage. Admins only. */
export const remove = mutation({
	args: {},
	handler: async (ctx) => {
		const caller = await getCaller(ctx);
		if (caller?.membership.role !== 'admin') {
			throw new ConvexError('Only team admins can change the team’s storage.');
		}
		await deleteTeamStorage(ctx, caller.team._id);
	},
});

export async function deleteTeamStorage(ctx: MutationCtx, teamId: Id<'teams'>) {
	const existing = await getConnection(ctx.db, teamId);
	if (existing) {
		await ctx.db.delete('storageConnections', existing._id);
	}
}
