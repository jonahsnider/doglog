import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	users: defineTable({
		encryptionKey: v.optional(v.object({ publicKey: v.bytes(), signature: v.bytes() })),
	}),
	// keyVersion is unset until the creator's Studio publishes the first team key. rotationPending is set when a
	// membership ends, until a remaining member's Studio publishes a fresh key.
	teams: defineTable({
		name: v.string(),
		keyVersion: v.optional(v.number()),
		rotationPending: v.optional(v.literal(true)),
	}),
	memberships: defineTable(
		v.union(
			v.object({
				userId: v.id('users'),
				teamId: v.id('teams'),
				role: v.literal('admin'),
				inviteToken: v.optional(v.string()),
			}),
			v.object({ userId: v.id('users'), teamId: v.id('teams'), role: v.literal('member') }),
		),
	)
		.index('by_user', ['userId'])
		.index('by_team', ['teamId'])
		.index('by_invite_token', ['inviteToken']),
	pendingJoins: defineTable({
		userId: v.id('users'),
		inviteToken: v.string(),
	})
		.index('by_user_and_invite', ['userId', 'inviteToken'])
		.index('by_invite_token', ['inviteToken']),
	// The team key, encrypted to one member's account key.
	teamKeys: defineTable({
		teamId: v.id('teams'),
		userId: v.id('users'),
		keyVersion: v.number(),
		wrappedKey: v.bytes(),
	}).index('by_team_user_and_version', ['teamId', 'userId', 'keyVersion']),
	// A dashboard shared with a team. seq is the last sequence number given to one of its updates. compactedSeq is the
	// latest snapshot that replaced every update before it, and compactedKeyVersion the key it's encrypted with.
	cloudDashboards: defineTable({
		teamId: v.id('teams'),
		dashboardId: v.string(),
		seq: v.number(),
		compactedSeq: v.optional(v.number()),
		compactedKeyVersion: v.optional(v.number()),
	}).index('by_team_and_dashboard', ['teamId', 'dashboardId']),
	// An encrypted Loro update or snapshot. Cloud can't read it, only order and relay it.
	dashboardUpdates: defineTable({
		dashboardId: v.id('cloudDashboards'),
		seq: v.number(),
		keyVersion: v.number(),
		iv: v.bytes(),
		ciphertext: v.bytes(),
	}).index('by_dashboard_and_seq', ['dashboardId', 'seq']),
	pairings: defineTable({
		userId: v.id('users'),
		expiresAt: v.number(),
		newDeviceKey: v.bytes(),
		approverKey: v.optional(v.bytes()),
		commitment: v.optional(v.bytes()),
		newDeviceNonce: v.optional(v.bytes()),
		approverNonce: v.optional(v.bytes()),
		credential: v.optional(v.object({ iv: v.bytes(), ciphertext: v.bytes() })),
	}).index('by_user', ['userId']),
});
