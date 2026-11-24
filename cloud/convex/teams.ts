import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { components } from './_generated/api';
import { deleteTeamDashboards } from './cloudDashboards';
import type { Doc, Id } from './_generated/dataModel';
import { type DatabaseReader, mutation, type MutationCtx, query } from './_generated/server';

export function getMembership(db: DatabaseReader, userId: Id<'users'>) {
	return db
		.query('memberships')
		.withIndex('by_user', (q) => q.eq('userId', userId))
		.unique();
}

async function isOnlyTeamMember(db: DatabaseReader, teamId: Id<'teams'>) {
	const members = await db
		.query('memberships')
		.withIndex('by_team', (q) => q.eq('teamId', teamId))
		.take(2);
	return members.length === 1;
}

async function hasOtherAdmin(db: DatabaseReader, membership: Doc<'memberships'>) {
	const otherAdmin = await db
		.query('memberships')
		.withIndex('by_team', (q) => q.eq('teamId', membership.teamId))
		.filter((q) => q.and(q.eq(q.field('role'), 'admin'), q.neq(q.field('_id'), membership._id)))
		.first();
	return otherAdmin !== null;
}

// Removes the account's membership and key grants. A former member is treated like one who never joined.
async function endMembership(ctx: MutationCtx, membership: Doc<'memberships'>) {
	await ctx.db.delete('memberships', membership._id);
	const grants = ctx.db
		.query('teamKeys')
		.withIndex('by_team_user_and_version', (q) => q.eq('teamId', membership.teamId).eq('userId', membership.userId));
	for await (const grant of grants) {
		await ctx.db.delete('teamKeys', grant._id);
	}
	const team = await ctx.db.get('teams', membership.teamId);
	if (team?.keyVersion !== undefined) {
		await ctx.db.patch('teams', team._id, { rotationPending: true });
	}
}

export const create = mutation({
	args: { name: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId || !(await ctx.db.get('users', userId))) {
			throw new ConvexError('Sign in to create a team.');
		}
		if (await getMembership(ctx.db, userId)) {
			throw new ConvexError('You already belong to a team.');
		}
		const name = args.name.trim();
		if (!name) {
			throw new ConvexError('Enter a team name.');
		}
		const teamId = await ctx.db.insert('teams', { name });
		await ctx.db.insert('memberships', { userId, teamId, role: 'admin' });
		return teamId;
	},
});

export const remove = mutation({
	args: { teamId: v.id('teams') },
	handler: async (ctx, { teamId }) => {
		const userId = await getAuthUserId(ctx);
		const membership = userId ? await getMembership(ctx.db, userId) : null;
		if (membership?.teamId !== teamId || membership.role !== 'admin' || !(await isOnlyTeamMember(ctx.db, teamId))) {
			throw new ConvexError('You can only delete a team when you’re its only member and an admin.');
		}
		await ctx.db.delete('memberships', membership._id);
		const keys = ctx.db.query('teamKeys').withIndex('by_team_user_and_version', (q) => q.eq('teamId', teamId));
		for await (const key of keys) {
			await ctx.db.delete('teamKeys', key._id);
		}
		await deleteTeamDashboards(ctx, teamId);
		await ctx.db.delete('teams', teamId);
	},
});

export const promote = mutation({
	args: { membershipId: v.id('memberships') },
	handler: async (ctx, { membershipId }) => {
		const callerId = await getAuthUserId(ctx);
		const caller = callerId ? await getMembership(ctx.db, callerId) : null;
		if (caller?.role !== 'admin') {
			throw new ConvexError('Only team admins can promote members.');
		}
		const member = await ctx.db.get('memberships', membershipId);
		if (member?.teamId !== caller.teamId) {
			throw new ConvexError('That account is not a member of your team.');
		}
		if (member.role === 'member') {
			await ctx.db.patch('memberships', member._id, { role: 'admin' });
		}
	},
});

export const demote = mutation({
	args: { membershipId: v.id('memberships') },
	handler: async (ctx, { membershipId }) => {
		const callerId = await getAuthUserId(ctx);
		const caller = callerId ? await getMembership(ctx.db, callerId) : null;
		if (caller?.role !== 'admin') {
			throw new ConvexError('Only team admins can remove admin rights.');
		}
		const member = await ctx.db.get('memberships', membershipId);
		if (member?.teamId !== caller.teamId) {
			throw new ConvexError('That account is not a member of your team.');
		}
		if (member.role === 'member') {
			return;
		}
		if (member._id === caller._id && !(await hasOtherAdmin(ctx.db, caller))) {
			throw new ConvexError('Make another member an admin before stepping down.');
		}
		await ctx.db.replace('memberships', member._id, {
			userId: member.userId,
			teamId: member.teamId,
			role: 'member',
		});
	},
});

export const leave = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		const membership = userId ? await getMembership(ctx.db, userId) : null;
		if (!membership) {
			throw new ConvexError('You’re not on a team.');
		}
		if (await isOnlyTeamMember(ctx.db, membership.teamId)) {
			throw new ConvexError('You’re the only member. Delete the team instead.');
		}
		if (membership.role === 'admin' && !(await hasOtherAdmin(ctx.db, membership))) {
			throw new ConvexError('Make another member an admin before leaving.');
		}
		await endMembership(ctx, membership);
	},
});

export const removeMember = mutation({
	args: { membershipId: v.id('memberships') },
	handler: async (ctx, { membershipId }) => {
		const callerId = await getAuthUserId(ctx);
		const caller = callerId ? await getMembership(ctx.db, callerId) : null;
		if (caller?.role !== 'admin') {
			throw new ConvexError('Only team admins can remove members.');
		}
		const member = await ctx.db.get('memberships', membershipId);
		if (member?.teamId !== caller.teamId) {
			throw new ConvexError('That account is not a member of your team.');
		}
		if (member._id === caller._id) {
			throw new ConvexError('Leave the team instead of removing yourself.');
		}
		await endMembership(ctx, member);
	},
});

export const listMembers = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		const membership = userId ? await getMembership(ctx.db, userId) : null;
		if (!membership) {
			return null;
		}
		const members = await ctx.db
			.query('memberships')
			.withIndex('by_team', (q) => q.eq('teamId', membership.teamId))
			.collect();
		return {
			canPromote: membership.role === 'admin',
			canRemove: membership.role === 'admin',
			canDemote:
				membership.role === 'admin' &&
				members.some((member) => member.role === 'admin' && member._id !== membership._id),
			members: await Promise.all(
				members.map(async (member) => ({
					id: member._id,
					role: member.role,
					isYou: member._id === membership._id,
					username: await ctx.runQuery(components.authUsername.public.getUsername, {
						userId: member.userId,
					}),
				})),
			),
		};
	},
});

export const getMine = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			return null;
		}
		const membership = await getMembership(ctx.db, userId);
		if (!membership) {
			return null;
		}
		const team = await ctx.db.get('teams', membership.teamId);
		const onlyMember = await isOnlyTeamMember(ctx.db, membership.teamId);
		return team
			? {
					id: team._id,
					membershipId: membership._id,
					name: team.name,
					role: membership.role,
					canDelete: membership.role === 'admin' && onlyMember,
					canLeave: !onlyMember && (membership.role === 'member' || (await hasOtherAdmin(ctx.db, membership))),
				}
			: null;
	},
});
