import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { type DatabaseReader, mutation, query, type QueryCtx } from './_generated/server';
import { getMembership } from './teams';

async function getAdmin(ctx: QueryCtx) {
	const userId = await getAuthUserId(ctx);
	const membership = userId ? await getMembership(ctx.db, userId) : null;
	return membership?.role === 'admin' ? membership : null;
}

export async function getInvitedTeam(db: DatabaseReader, token: string) {
	const admin = await db
		.query('memberships')
		.withIndex('by_invite_token', (q) => q.eq('inviteToken', token))
		.unique();
	return admin?.role === 'admin' ? db.get('teams', admin.teamId) : null;
}

export const getMine = query({
	args: {},
	handler: async (ctx) => (await getAdmin(ctx))?.inviteToken ?? null,
});

export const issue = mutation({
	args: {},
	handler: async (ctx) => {
		const admin = await getAdmin(ctx);
		if (!admin) {
			throw new ConvexError('Only team admins can create invite links.');
		}
		if (admin.inviteToken !== undefined) {
			return admin.inviteToken;
		}
		// The generated API types pull this server code into Studio's ES2023 type check.
		const token = (
			crypto.getRandomValues(new Uint8Array(32)) as Uint8Array & {
				toBase64(options?: { alphabet?: 'base64' | 'base64url'; omitPadding?: boolean }): string;
			}
		).toBase64({ alphabet: 'base64url', omitPadding: true });
		await ctx.db.patch('memberships', admin._id, { inviteToken: token });
		return token;
	},
});

export const revoke = mutation({
	args: {},
	handler: async (ctx) => {
		const admin = await getAdmin(ctx);
		if (!admin) {
			throw new ConvexError('Only team admins can revoke invite links.');
		}
		await ctx.db.patch('memberships', admin._id, { inviteToken: undefined });
	},
});

export const accept = mutation({
	args: { token: v.string() },
	handler: async (ctx, { token }) => {
		const userId = await getAuthUserId(ctx);
		if (!userId || !(await ctx.db.get('users', userId))) {
			throw new ConvexError('Sign in to accept a team invite.');
		}
		if (await getMembership(ctx.db, userId)) {
			throw new ConvexError('You already belong to a team.');
		}
		if (!(await getInvitedTeam(ctx.db, token))) {
			throw new ConvexError('This team invite is no longer valid.');
		}
		const pending = await ctx.db
			.query('pendingJoins')
			.withIndex('by_user_and_invite', (q) => q.eq('userId', userId).eq('inviteToken', token))
			.unique();
		return pending?._id ?? ctx.db.insert('pendingJoins', { userId, inviteToken: token });
	},
});

export const cancel = mutation({
	args: { pendingJoinId: v.id('pendingJoins') },
	handler: async (ctx, { pendingJoinId }) => {
		const userId = await getAuthUserId(ctx);
		const pending = await ctx.db.get('pendingJoins', pendingJoinId);
		if (userId && pending?.userId === userId) {
			await ctx.db.delete('pendingJoins', pendingJoinId);
		}
	},
});

export const preview = query({
	args: { token: v.string() },
	handler: async (ctx, { token }) => {
		const team = await getInvitedTeam(ctx.db, token);
		return team ? { teamName: team.name } : null;
	},
});

export async function getPendingInvites(db: DatabaseReader, userId: Id<'users'>) {
	const joins = await db
		.query('pendingJoins')
		.withIndex('by_user_and_invite', (q) => q.eq('userId', userId))
		.collect();
	const teams = await Promise.all(
		joins.map(async (join) => {
			const team = await getInvitedTeam(db, join.inviteToken);
			return team ? [{ id: join._id, teamName: team.name }] : [];
		}),
	);
	return teams.flat();
}

export const listPending = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId || (await getMembership(ctx.db, userId))) {
			return [];
		}
		return getPendingInvites(ctx.db, userId);
	},
});
