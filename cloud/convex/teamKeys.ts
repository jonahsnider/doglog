import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { type DatabaseReader, mutation, query, type QueryCtx } from './_generated/server';
import { getInvitedTeam } from './invites';
import { getMembership } from './teams';

// RSA-OAEP ciphertext size for a 3072-bit account key
const wrappedKeyLength = 384;

function checkWrappedKey(wrappedKey: ArrayBuffer) {
	if (wrappedKey.byteLength !== wrappedKeyLength) {
		throw new ConvexError('Invalid team key.');
	}
}

function getGrant(db: DatabaseReader, teamId: Id<'teams'>, userId: Id<'users'>, keyVersion: number) {
	return db
		.query('teamKeys')
		.withIndex('by_team_user_and_version', (q) =>
			q.eq('teamId', teamId).eq('userId', userId).eq('keyVersion', keyVersion),
		)
		.unique();
}

async function getCallerTeam(ctx: QueryCtx) {
	const userId = await getAuthUserId(ctx);
	const membership = userId ? await getMembership(ctx.db, userId) : null;
	const team = membership ? await ctx.db.get('teams', membership.teamId) : null;
	return membership && team ? { membership, team } : null;
}

function listMembers(db: DatabaseReader, teamId: Id<'teams'>) {
	return db
		.query('memberships')
		.withIndex('by_team', (q) => q.eq('teamId', teamId))
		.collect();
}

// The caller's grant of the current team key. keyVersion is null until the team's first key is published. While a
// rotation is pending, this also lists the remaining members a fresh key must be granted to.
export const getMine = query({
	args: {},
	handler: async (ctx) => {
		const caller = await getCallerTeam(ctx);
		if (!caller) {
			return null;
		}
		const { membership, team } = caller;
		const grant =
			team.keyVersion === undefined ? null : await getGrant(ctx.db, team._id, membership.userId, team.keyVersion);
		const recipients = team.rotationPending
			? await Promise.all(
					(await listMembers(ctx.db, team._id)).map(async (member) => ({
						userId: member.userId,
						encryptionKey: (await ctx.db.get('users', member.userId))?.encryptionKey ?? null,
					})),
				)
			: null;
		return {
			teamId: team._id,
			keyVersion: team.keyVersion ?? null,
			wrappedKey: grant?.wrappedKey ?? null,
			rotation: recipients && { recipients },
		};
	},
});

// The caller's grant of an earlier key version, for re-encrypting older updates under the current key after a rotation
export const getVersion = query({
	args: { keyVersion: v.number() },
	handler: async (ctx, { keyVersion }) => {
		const caller = await getCallerTeam(ctx);
		const grant = caller ? await getGrant(ctx.db, caller.team._id, caller.membership.userId, keyVersion) : null;
		return grant?.wrappedKey ?? null;
	},
});

export const initialize = mutation({
	args: { teamId: v.id('teams'), wrappedKey: v.bytes() },
	handler: async (ctx, { teamId, wrappedKey }) => {
		checkWrappedKey(wrappedKey);
		const caller = await getCallerTeam(ctx);
		if (caller?.team._id !== teamId) {
			throw new ConvexError('You’re not a member of this team.');
		}
		if (caller.team.keyVersion !== undefined) {
			throw new ConvexError('This team already has a key.');
		}
		await ctx.db.patch('teams', teamId, { keyVersion: 1 });
		await ctx.db.insert('teamKeys', { teamId, userId: caller.membership.userId, keyVersion: 1, wrappedKey });
	},
});

// Publishes a fresh team key after a membership ended. Cloud checks the grants cover exactly the current members, in
// the same transaction, so a member who ended up removed meanwhile can't receive the new key.
export const rotate = mutation({
	args: {
		keyVersion: v.number(),
		grants: v.array(v.object({ userId: v.id('users'), wrappedKey: v.bytes() })),
	},
	handler: async (ctx, { keyVersion, grants }) => {
		const caller = await getCallerTeam(ctx);
		const team = caller?.team;
		if (
			!caller ||
			team?.keyVersion === undefined ||
			!team.rotationPending ||
			keyVersion !== team.keyVersion + 1 ||
			!(await getGrant(ctx.db, team._id, caller.membership.userId, team.keyVersion))
		) {
			throw new ConvexError('The team key changed. Try again.');
		}
		const members = new Set((await listMembers(ctx.db, team._id)).map((member) => member.userId));
		const recipients = new Set(grants.map((grant) => grant.userId));
		if (
			recipients.size !== grants.length ||
			recipients.size !== members.size ||
			!grants.every((grant) => members.has(grant.userId))
		) {
			throw new ConvexError('The team’s members changed. Try again.');
		}
		for (const { wrappedKey } of grants) {
			checkWrappedKey(wrappedKey);
		}
		await Promise.all(grants.map((grant) => ctx.db.insert('teamKeys', { teamId: team._id, keyVersion, ...grant })));
		await ctx.db.patch('teams', team._id, { keyVersion, rotationPending: undefined });
	},
});

// Joins a teammate's Studio can complete: the invite is still valid, the account has no team, and Cloud attested its key.
export const listPendingJoins = query({
	args: {},
	handler: async (ctx) => {
		const caller = await getCallerTeam(ctx);
		const keyVersion = caller?.team.keyVersion;
		if (
			!caller ||
			keyVersion === undefined ||
			caller.team.rotationPending ||
			!(await getGrant(ctx.db, caller.team._id, caller.membership.userId, keyVersion))
		) {
			return [];
		}
		const members = await listMembers(ctx.db, caller.team._id);
		const tokens = members.flatMap((member) =>
			member.role === 'admin' && member.inviteToken !== undefined ? [member.inviteToken] : [],
		);
		const joins = await Promise.all(
			tokens.map((token) =>
				ctx.db
					.query('pendingJoins')
					.withIndex('by_invite_token', (q) => q.eq('inviteToken', token))
					.collect(),
			),
		);
		const requests = await Promise.all(
			joins.flat().map(async (join) => {
				const user = await ctx.db.get('users', join.userId);
				if (!user?.encryptionKey || (await getMembership(ctx.db, join.userId))) {
					return [];
				}
				return [{ id: join._id, userId: join.userId, keyVersion, encryptionKey: user.encryptionKey }];
			}),
		);
		return requests.flat();
	},
});

// Cloud only accepts a grant from a member who holds the current key, and rechecks the invite in the same transaction.
export const completeJoin = mutation({
	args: { pendingJoinId: v.id('pendingJoins'), keyVersion: v.number(), wrappedKey: v.bytes() },
	handler: async (ctx, { pendingJoinId, keyVersion, wrappedKey }) => {
		checkWrappedKey(wrappedKey);
		const caller = await getCallerTeam(ctx);
		const pending = await ctx.db.get('pendingJoins', pendingJoinId);
		if (!caller || !pending) {
			throw new ConvexError('This join request ended.');
		}
		const { membership, team } = caller;
		if ((await getInvitedTeam(ctx.db, pending.inviteToken))?._id !== team._id) {
			throw new ConvexError('This team invite is no longer valid.');
		}
		if (
			team.keyVersion !== keyVersion ||
			team.rotationPending ||
			!(await getGrant(ctx.db, team._id, membership.userId, keyVersion))
		) {
			throw new ConvexError('The team key changed. Try again.');
		}
		const invitee = await ctx.db.get('users', pending.userId);
		if (!invitee?.encryptionKey) {
			throw new ConvexError('That account doesn’t have an encryption key yet.');
		}
		if (await getMembership(ctx.db, invitee._id)) {
			throw new ConvexError('That account already belongs to a team.');
		}
		await ctx.db.insert('memberships', { userId: invitee._id, teamId: team._id, role: 'member' });
		await ctx.db.insert('teamKeys', { teamId: team._id, userId: invitee._id, keyVersion, wrappedKey });
		const joins = ctx.db.query('pendingJoins').withIndex('by_user_and_invite', (q) => q.eq('userId', invitee._id));
		for await (const join of joins) {
			await ctx.db.delete('pendingJoins', join._id);
		}
	},
});
