import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';

export const create = internalMutation({
	args: { method: v.object({ name: v.literal('usernamePasskey'), profile: v.object({}) }) },
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
