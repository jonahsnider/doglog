import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	users: defineTable({}),
	teams: defineTable({ name: v.string() }),
	memberships: defineTable({
		userId: v.id('users'),
		teamId: v.id('teams'),
		role: v.union(v.literal('admin'), v.literal('member')),
	}).index('by_user', ['userId']),
});
