import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { type DatabaseReader, mutation, type MutationCtx, query, type QueryCtx } from './_generated/server';
import { getMembership } from './teams';

// Leaves room under Convex's 1 MiB document limit
const maxCiphertextLength = 900_000;
const maxReplaced = 1000;
const pullLimit = 100;

async function getCallerMembership(ctx: QueryCtx) {
	const userId = await getAuthUserId(ctx);
	return userId ? getMembership(ctx.db, userId) : null;
}

function getDashboard(db: DatabaseReader, teamId: Id<'teams'>, dashboardId: string) {
	return db
		.query('cloudDashboards')
		.withIndex('by_team_and_dashboard', (q) => q.eq('teamId', teamId).eq('dashboardId', dashboardId))
		.unique();
}

export const list = query({
	args: {},
	handler: async (ctx) => {
		const membership = await getCallerMembership(ctx);
		if (!membership) {
			return null;
		}
		const dashboards = await ctx.db
			.query('cloudDashboards')
			.withIndex('by_team_and_dashboard', (q) => q.eq('teamId', membership.teamId))
			.collect();
		return dashboards.map(({ dashboardId, seq, compactedSeq, compactedKeyVersion }) => ({
			dashboardId,
			seq,
			compactedSeq: compactedSeq ?? null,
			compactedKeyVersion: compactedKeyVersion ?? null,
		}));
	},
});

// Updates after `after` in order, a page at a time. Studio advances `after` as it imports them.
export const pull = query({
	args: { dashboardId: v.string(), after: v.number() },
	handler: async (ctx, { dashboardId, after }) => {
		const membership = await getCallerMembership(ctx);
		const dashboard = membership ? await getDashboard(ctx.db, membership.teamId, dashboardId) : null;
		if (!dashboard) {
			return null;
		}
		const updates = await ctx.db
			.query('dashboardUpdates')
			.withIndex('by_dashboard_and_seq', (q) => q.eq('dashboardId', dashboard._id).gt('seq', after))
			.take(pullLimit);
		return updates.map(({ seq, keyVersion, iv, ciphertext }) => ({ seq, keyVersion, iv, ciphertext }));
	},
});

async function checkUpload(ctx: MutationCtx, membershipId: Id<'memberships'>, keyVersion: number) {
	const membership = await getCallerMembership(ctx);
	// Edits made under an ended membership are rejected, even if the account rejoined since
	if (membership?._id !== membershipId) {
		throw new ConvexError('You’re no longer on the team these edits were made in.');
	}
	const team = await ctx.db.get('teams', membership.teamId);
	if (team?.keyVersion !== keyVersion || team.rotationPending) {
		throw new ConvexError('The team key changed. Try again.');
	}
	return membership;
}

/**
 * Add an encrypted update to a team dashboard, sharing the dashboard if it's new. A snapshot sets `replacesThrough` to
 * the last update it includes, and the updates it replaces are deleted. This keeps dashboards small and readable with
 * only the current key.
 */
export const push = mutation({
	args: {
		membershipId: v.id('memberships'),
		dashboardId: v.string(),
		keyVersion: v.number(),
		iv: v.bytes(),
		ciphertext: v.bytes(),
		replacesThrough: v.optional(v.number()),
	},
	handler: async (ctx, { membershipId, dashboardId, keyVersion, iv, ciphertext, replacesThrough }) => {
		if (
			iv.byteLength !== 12 ||
			ciphertext.byteLength > maxCiphertextLength ||
			dashboardId.length === 0 ||
			dashboardId.length > 64
		) {
			throw new ConvexError('Invalid dashboard update.');
		}
		const { teamId } = await checkUpload(ctx, membershipId, keyVersion);
		const existing = await getDashboard(ctx.db, teamId, dashboardId);
		const previous = existing?.seq ?? 0;
		const seq = previous + 1;
		const id = existing?._id ?? (await ctx.db.insert('cloudDashboards', { teamId, dashboardId, seq }));
		let compacted = false;
		if (replacesThrough !== undefined) {
			const replaced = await ctx.db
				.query('dashboardUpdates')
				.withIndex('by_dashboard_and_seq', (q) => q.eq('dashboardId', id).lte('seq', replacesThrough))
				.take(maxReplaced + 1);
			await Promise.all(replaced.slice(0, maxReplaced).map((update) => ctx.db.delete('dashboardUpdates', update._id)));
			// Only a snapshot that includes every earlier update can stand in for them
			compacted = replacesThrough === previous && replaced.length <= maxReplaced;
		}
		await ctx.db.patch(
			'cloudDashboards',
			id,
			compacted ? { seq, compactedSeq: seq, compactedKeyVersion: keyVersion } : { seq },
		);
		await ctx.db.insert('dashboardUpdates', { dashboardId: id, seq, keyVersion, iv, ciphertext });
		return seq;
	},
});

export async function deleteTeamDashboards(ctx: MutationCtx, teamId: Id<'teams'>) {
	const dashboards = ctx.db.query('cloudDashboards').withIndex('by_team_and_dashboard', (q) => q.eq('teamId', teamId));
	for await (const dashboard of dashboards) {
		const updates = ctx.db
			.query('dashboardUpdates')
			.withIndex('by_dashboard_and_seq', (q) => q.eq('dashboardId', dashboard._id));
		for await (const update of updates) {
			await ctx.db.delete('dashboardUpdates', update._id);
		}
		await ctx.db.delete('cloudDashboards', dashboard._id);
	}
}
