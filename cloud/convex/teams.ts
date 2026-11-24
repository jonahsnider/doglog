import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const create = mutation({
	args: { name: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId || !(await ctx.db.get('users', userId))) {
			throw new ConvexError('Sign in to create a team.');
		}
		const membership = await ctx.db
			.query('memberships')
			.withIndex('by_user', (q) => q.eq('userId', userId))
			.unique();
		if (membership) {
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

export const getMine = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			return null;
		}
		const membership = await ctx.db
			.query('memberships')
			.withIndex('by_user', (q) => q.eq('userId', userId))
			.unique();
		if (!membership) {
			return null;
		}
		const team = await ctx.db.get('teams', membership.teamId);
		return team ? { id: team._id, name: team.name, role: membership.role } : null;
	},
});
