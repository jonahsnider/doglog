import { registerCore, sessionIdentity } from '@convex-dev/auth/test';
import { convexTest, type TestConvex } from 'convex-test';
import { afterEach, expect, test, vi } from 'vite-plus/test';
import { unwrapTeamKey, wrapTeamKey } from '../../studio/src/cloud/team-key';
import { api, components } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

afterEach(() => vi.unstubAllEnvs());

function setup() {
	vi.stubEnv('CONVEX_CLOUD_URL', 'https://convex.example.test');
	const t = convexTest(schema, modules);
	registerCore(t);
	return t;
}

async function signIn(t: TestConvex<typeof schema>) {
	const userId = await t.run((ctx) => ctx.db.insert('users', {}));
	const tokens = await t.mutation(components.auth.public._internal_dangerous_signIn, {
		userId,
		componentPath: 'authPasskey',
		claims: { method: 'passkey', profile: {} },
		accessTokenTtlSeconds: 300,
		refreshInactivityTimeoutSeconds: 3600,
		sessionMaxLifetimeSeconds: 3600,
	});
	return { userId, client: t.withIdentity(sessionIdentity(tokens)) };
}

test('team creation requires a signed-in account', async () => {
	const t = setup();
	await expect(t.query(api.users.getCurrent)).resolves.toBeNull();
	await expect(t.query(api.teams.getMine)).resolves.toBeNull();
	await expect(t.mutation(api.teams.create, { name: 'Robodogs' })).rejects.toThrow('Sign in to create a team.');
});

test('simultaneous creates leave the account as admin of just one team', async () => {
	const { client, userId } = await signIn(setup());
	await expect(client.query(api.users.getCurrent)).resolves.toEqual({ id: userId, displayName: null });
	const attempts = ['Robodogs', 'Space Dogs'].map(async (name) => ({
		id: await client.mutation(api.teams.create, { name }),
		name,
		membershipId: expect.any(String),
		role: 'admin',
		canDelete: true,
		canLeave: false,
	}));
	const outcomes = await Promise.allSettled(attempts);
	const created = outcomes.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : []));
	expect(created).toHaveLength(1);
	await expect(client.query(api.teams.getMine)).resolves.toEqual(created[0]);
});

test('team lookup is scoped to the signed-in account', async () => {
	const t = setup();
	const { client: alice } = await signIn(t);
	const { client: bob } = await signIn(t);
	const aliceTeam = await alice.mutation(api.teams.create, { name: 'Robodogs' });
	await expect(bob.query(api.teams.getMine)).resolves.toBeNull();
	const bobTeam = await bob.mutation(api.teams.create, { name: 'Space Dogs' });
	await expect(alice.query(api.teams.getMine)).resolves.toEqual({
		id: aliceTeam,
		name: 'Robodogs',
		membershipId: expect.any(String),
		role: 'admin',
		canDelete: true,
		canLeave: false,
	});
	await expect(bob.query(api.teams.getMine)).resolves.toEqual({
		id: bobTeam,
		name: 'Space Dogs',
		membershipId: expect.any(String),
		role: 'admin',
		canDelete: true,
		canLeave: false,
	});
});

test('only a solo admin can delete their team and its invite, without deleting their account', async () => {
	const t = setup();
	const { client: admin, userId: adminId } = await signIn(t);
	const { client: member, userId } = await signIn(t);
	const { client: invitee } = await signIn(t);
	const teamId = await admin.mutation(api.teams.create, { name: 'Robodogs' });
	const token = await admin.mutation(api.invites.issue);
	await invitee.mutation(api.invites.accept, { token });
	await expect(invitee.mutation(api.teams.remove, { teamId })).rejects.toThrow('only member');

	const membershipId = await t.run((ctx) => ctx.db.insert('memberships', { userId, teamId, role: 'member' }));
	await expect(admin.query(api.teams.getMine)).resolves.toMatchObject({ canDelete: false });
	await expect(admin.mutation(api.teams.remove, { teamId })).rejects.toThrow('only member');
	await expect(member.mutation(api.teams.remove, { teamId })).rejects.toThrow('only member');
	await expect(t.mutation(api.users.remove)).rejects.toThrow('Sign in');
	await expect(member.mutation(api.users.remove)).rejects.toThrow('don’t belong to a team');
	await expect(member.query(api.teams.getMine)).resolves.toMatchObject({ id: teamId });

	await t.run((ctx) => ctx.db.delete('memberships', membershipId));
	await admin.mutation(api.teams.remove, { teamId });
	await expect(admin.query(api.teams.getMine)).resolves.toBeNull();
	await expect(admin.query(api.users.getCurrent)).resolves.toEqual({ id: adminId, displayName: null });
	await expect(invitee.query(api.invites.listPending)).resolves.toEqual([]);
	await expect(invitee.mutation(api.invites.accept, { token })).rejects.toThrow('no longer valid');
	const newTeamId = await admin.mutation(api.teams.create, { name: 'Space Dogs' });
	await expect(admin.mutation(api.teams.remove, { teamId })).rejects.toThrow('only member');
	await expect(admin.query(api.teams.getMine)).resolves.toMatchObject({ id: newTeamId });
});

test('Cloud attests the first account key and Studio wraps only to the attested recipient', async () => {
	const t = setup();
	const { client: alice, userId: aliceId } = await signIn(t);
	const { client: bob, userId: bobId } = await signIn(t);
	const teamId = await alice.mutation(api.teams.create, { name: 'Robodogs' });
	const rsa = {
		name: 'RSA-OAEP',
		modulusLength: 3072,
		publicExponent: Uint8Array.of(1, 0, 1),
		hash: 'SHA-256',
	};
	const [signer, bobKeys, otherKeys] = await Promise.all([
		crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']),
		crypto.subtle.generateKey(rsa, false, ['encrypt', 'decrypt']),
		crypto.subtle.generateKey(rsa, false, ['encrypt', 'decrypt']),
	]);
	const publicKey = await crypto.subtle.exportKey('spki', bobKeys.publicKey);
	const otherPublicKey = await crypto.subtle.exportKey('spki', otherKeys.publicKey);
	const trustedCloudKey = await crypto.subtle.exportKey('spki', signer.publicKey);
	const signingKey = await crypto.subtle.exportKey('pkcs8', signer.privateKey);

	const registration = { userId: bobId, publicKey };
	await expect(t.action(api.users.registerEncryptionKey, registration)).rejects.toThrow('Sign in');
	await expect(alice.action(api.users.registerEncryptionKey, registration)).rejects.toThrow('Sign in');
	vi.stubEnv('ATTESTATION_PRIVATE_KEY', '');
	await expect(bob.action(api.users.registerEncryptionKey, registration)).rejects.toThrow('unavailable');
	vi.stubEnv('ATTESTATION_PRIVATE_KEY', btoa(String.fromCharCode(...new Uint8Array(signingKey))));
	await expect(
		bob.action(api.users.registerEncryptionKey, { ...registration, publicKey: trustedCloudKey }),
	).rejects.toThrow('Invalid');
	const attestation = await bob.action(api.users.registerEncryptionKey, registration);
	await expect(bob.query(api.users.getMyEncryptionKey)).resolves.toEqual(attestation);
	await expect(alice.query(api.users.getMyEncryptionKey)).resolves.toBeNull();
	await expect(bob.action(api.users.registerEncryptionKey, registration)).resolves.toEqual(attestation);
	await expect(
		bob.action(api.users.registerEncryptionKey, { ...registration, publicKey: otherPublicKey }),
	).rejects.toThrow('already has');

	const teamKey = crypto.getRandomValues(new Uint8Array(32)).buffer;
	const context = { teamId, recipientId: bobId, keyVersion: 3 };
	const wrapped = await wrapTeamKey(teamKey, context, attestation, trustedCloudKey);
	await expect(unwrapTeamKey(wrapped, context, bobKeys.privateKey)).resolves.toEqual(teamKey);
	await expect(unwrapTeamKey(wrapped, context, otherKeys.privateKey)).rejects.toHaveProperty('name', 'OperationError');
	await expect(unwrapTeamKey(wrapped, { ...context, keyVersion: 2 }, bobKeys.privateKey)).rejects.toHaveProperty(
		'name',
		'OperationError',
	);
	await expect(
		wrapTeamKey(teamKey, { ...context, recipientId: aliceId }, attestation, trustedCloudKey),
	).rejects.toThrow('Invalid account key attestation');
	await expect(
		wrapTeamKey(teamKey, context, { ...attestation, publicKey: otherPublicKey }, trustedCloudKey),
	).rejects.toThrow('Invalid account key attestation');
});

async function registerKey(client: Awaited<ReturnType<typeof signIn>>) {
	const keys = await crypto.subtle.generateKey(
		{ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' },
		false,
		['encrypt', 'decrypt'],
	);
	const publicKey = await crypto.subtle.exportKey('spki', keys.publicKey);
	await client.client.action(api.users.registerEncryptionKey, { userId: client.userId, publicKey });
	return keys.privateKey;
}

test('a teammate holding the team key completes each valid join exactly once', async () => {
	const t = setup();
	const signer = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
	const signingKey = new Uint8Array(await crypto.subtle.exportKey('pkcs8', signer.privateKey));
	vi.stubEnv('ATTESTATION_PRIVATE_KEY', btoa(String.fromCharCode(...signingKey)));
	const admin = await signIn(t);
	const invitee = await signIn(t);
	const revoked = await signIn(t);
	const keyless = await signIn(t);
	const outsider = await signIn(t);
	const [adminKey, inviteeKey] = await Promise.all([registerKey(admin), registerKey(invitee), registerKey(revoked)]);
	const trustedCloudKey = await admin.client.query(api.users.getAttestationKey);
	expect(trustedCloudKey).toEqual(await crypto.subtle.exportKey('spki', signer.publicKey));

	const teamId = await admin.client.mutation(api.teams.create, { name: 'Robodogs' });
	await outsider.client.mutation(api.teams.create, { name: 'Space Dogs' });
	await expect(admin.client.query(api.teamKeys.getMine)).resolves.toEqual({
		teamId,
		keyVersion: null,
		wrappedKey: null,
		rotation: null,
	});
	const teamKey = crypto.getRandomValues(new Uint8Array(32)).buffer;
	const grant = async (recipient: typeof admin) =>
		wrapTeamKey(
			teamKey,
			{ teamId, recipientId: recipient.userId, keyVersion: 1 },
			(await recipient.client.query(api.users.getMyEncryptionKey))!,
			trustedCloudKey!,
		);
	await expect(
		outsider.client.mutation(api.teamKeys.initialize, { teamId, wrappedKey: await grant(admin) }),
	).rejects.toThrow('not a member');
	await admin.client.mutation(api.teamKeys.initialize, { teamId, wrappedKey: await grant(admin) });
	await expect(
		admin.client.mutation(api.teamKeys.initialize, { teamId, wrappedKey: await grant(admin) }),
	).rejects.toThrow('already has a key');
	const own = await admin.client.query(api.teamKeys.getMine);
	await expect(
		unwrapTeamKey(own!.wrappedKey!, { teamId, recipientId: admin.userId, keyVersion: 1 }, adminKey),
	).resolves.toEqual(teamKey);

	const token = await admin.client.mutation(api.invites.issue);
	const pendingJoinId = await invitee.client.mutation(api.invites.accept, { token });
	await keyless.client.mutation(api.invites.accept, { token });
	const revokedJoinId = await revoked.client.mutation(api.invites.accept, { token });
	const requests = await admin.client.query(api.teamKeys.listPendingJoins);
	expect(requests.map(({ userId }) => userId).sort()).toEqual([invitee.userId, revoked.userId].sort());
	await expect(outsider.client.query(api.teamKeys.listPendingJoins)).resolves.toEqual([]);

	const wrappedKey = await grant(invitee);
	await expect(
		admin.client.mutation(api.teamKeys.completeJoin, { pendingJoinId, keyVersion: 1, wrappedKey: bytes(32) }),
	).rejects.toThrow('Invalid team key');
	await expect(
		admin.client.mutation(api.teamKeys.completeJoin, { pendingJoinId, keyVersion: 2, wrappedKey }),
	).rejects.toThrow('key changed');
	await expect(
		outsider.client.mutation(api.teamKeys.completeJoin, { pendingJoinId, keyVersion: 1, wrappedKey }),
	).rejects.toThrow('no longer valid');
	const outcomes = await Promise.allSettled(
		[0, 1].map(() => admin.client.mutation(api.teamKeys.completeJoin, { pendingJoinId, keyVersion: 1, wrappedKey })),
	);
	expect(outcomes.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
	await expect(invitee.client.query(api.teams.getMine)).resolves.toMatchObject({ id: teamId, role: 'member' });
	await expect(invitee.client.query(api.invites.listPending)).resolves.toEqual([]);
	const received = await invitee.client.query(api.teamKeys.getMine);
	await expect(
		unwrapTeamKey(received!.wrappedKey!, { teamId, recipientId: invitee.userId, keyVersion: 1 }, inviteeKey),
	).resolves.toEqual(teamKey);

	await admin.client.mutation(api.invites.revoke);
	await expect(invitee.client.query(api.teamKeys.listPendingJoins)).resolves.toEqual([]);
	await expect(
		invitee.client.mutation(api.teamKeys.completeJoin, {
			pendingJoinId: revokedJoinId,
			keyVersion: 1,
			wrappedKey: await grant(revoked),
		}),
	).rejects.toThrow('no longer valid');
	await expect(revoked.client.query(api.teams.getMine)).resolves.toBeNull();
});

test('a reusable invite creates private pending joins, not memberships', async () => {
	const t = setup();
	const { client: admin } = await signIn(t);
	const { client: alice } = await signIn(t);
	const { client: bob } = await signIn(t);
	await admin.mutation(api.teams.create, { name: 'Robodogs' });
	const token = await admin.mutation(api.invites.issue);
	await expect(admin.mutation(api.invites.issue)).resolves.toBe(token);
	await expect(t.mutation(api.invites.accept, { token })).rejects.toThrow('Sign in');
	const id = await alice.mutation(api.invites.accept, { token });
	await expect(alice.mutation(api.invites.accept, { token })).resolves.toBe(id);
	await expect(bob.query(api.invites.listPending)).resolves.toEqual([]);
	const bobId = await bob.mutation(api.invites.accept, { token });
	for (const [client, request] of [
		[alice, id],
		[bob, bobId],
	] as const) {
		await expect(client.query(api.invites.listPending)).resolves.toEqual([{ id: request, teamName: 'Robodogs' }]);
		await expect(client.query(api.teams.getMine)).resolves.toBeNull();
	}
	const bobTeam = await bob.mutation(api.teams.create, { name: 'Space Dogs' });
	await expect(bob.query(api.invites.listPending)).resolves.toEqual([]);
	await expect(bob.mutation(api.invites.accept, { token })).rejects.toThrow('already belong');
	await expect(bob.query(api.teams.getMine)).resolves.toMatchObject({ id: bobTeam });

	await admin.mutation(api.invites.revoke);
	await expect(admin.query(api.invites.getMine)).resolves.toBeNull();
	await expect(admin.mutation(api.invites.issue)).resolves.not.toBe(token);
	await expect(alice.query(api.invites.listPending)).resolves.toEqual([]);
	await expect(alice.mutation(api.invites.accept, { token })).rejects.toThrow('no longer valid');
});

test('links are per admin and losing the role permanently invalidates the link', async () => {
	const t = setup();
	const { client: admin } = await signIn(t);
	const { client: second, userId } = await signIn(t);
	const { client: invitee } = await signIn(t);
	const { client: otherAdmin } = await signIn(t);
	await otherAdmin.mutation(api.teams.create, { name: 'Space Dogs' });
	const teamId = await admin.mutation(api.teams.create, { name: 'Robodogs' });
	const membershipId = await t.run((ctx) => ctx.db.insert('memberships', { userId, teamId, role: 'admin' }));
	const firstToken = await admin.mutation(api.invites.issue);
	const secondToken = await second.mutation(api.invites.issue);
	expect(secondToken).not.toBe(firstToken);
	await invitee.mutation(api.invites.accept, { token: secondToken });

	await expect(otherAdmin.mutation(api.teams.demote, { membershipId })).rejects.toThrow('not a member of your team');
	await admin.mutation(api.teams.demote, { membershipId });
	await expect(second.query(api.invites.getMine)).resolves.toBeNull();
	await expect(second.mutation(api.invites.issue)).rejects.toThrow('Only team admins');
	await expect(second.mutation(api.invites.revoke)).rejects.toThrow('Only team admins');
	await expect(invitee.query(api.invites.listPending)).resolves.toEqual([]);
	await expect(second.mutation(api.teams.promote, { membershipId })).rejects.toThrow('Only team admins');
	await expect(otherAdmin.mutation(api.teams.promote, { membershipId })).rejects.toThrow('not a member of your team');
	await expect(second.query(api.teams.getMine)).resolves.toMatchObject({ role: 'member' });
	await admin.mutation(api.teams.promote, { membershipId });
	await expect(second.query(api.teams.getMine)).resolves.toMatchObject({ role: 'admin' });
	await expect(invitee.mutation(api.invites.accept, { token: secondToken })).rejects.toThrow('no longer valid');
	const replacement = await second.mutation(api.invites.issue);
	await admin.mutation(api.teams.promote, { membershipId });
	await expect(second.query(api.invites.getMine)).resolves.toBe(replacement);
	await expect(admin.query(api.invites.getMine)).resolves.toBe(firstToken);
	await expect(invitee.mutation(api.invites.accept, { token: firstToken })).resolves.toBeDefined();
});

test('two admins cannot both step down', async () => {
	const t = setup();
	const { client: first } = await signIn(t);
	const { client: second, userId } = await signIn(t);
	const teamId = await first.mutation(api.teams.create, { name: 'Robodogs' });
	const firstId = (await first.query(api.teams.listMembers))!.members[0]!.id;
	const secondId = await t.run((ctx) => ctx.db.insert('memberships', { userId, teamId, role: 'member' }));

	await expect(first.mutation(api.teams.demote, { membershipId: firstId })).rejects.toThrow('before stepping down');
	await expect(second.mutation(api.teams.demote, { membershipId: firstId })).rejects.toThrow('Only team admins');
	await expect(first.query(api.teams.listMembers)).resolves.toMatchObject({ canDemote: false });
	await first.mutation(api.teams.promote, { membershipId: secondId });
	await expect(first.query(api.teams.listMembers)).resolves.toMatchObject({ canDemote: true });
	const outcomes = await Promise.allSettled([
		first.mutation(api.teams.demote, { membershipId: firstId }),
		second.mutation(api.teams.demote, { membershipId: secondId }),
	]);
	expect(outcomes.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
	const roster = await second.query(api.teams.listMembers);
	expect(roster?.canDemote).toBe(false);
	expect(roster?.members.map(({ role }) => role).sort()).toEqual(['admin', 'member']);
});

test('the roster shows only teammates and promotion applies to the selected membership', async () => {
	const t = setup();
	const { client: admin } = await signIn(t);
	const { client: member, userId } = await signIn(t);
	const { client: outsider } = await signIn(t);
	await expect(t.mutation(api.users.setDisplayName, { displayName: 'Sam Lee' })).rejects.toThrow('Sign in');
	await expect(member.mutation(api.users.setDisplayName, { displayName: '   ' })).rejects.toThrow(
		'Enter a display name',
	);
	await admin.mutation(api.users.setDisplayName, { displayName: 'Sam Lee' });
	await member.mutation(api.users.setDisplayName, { displayName: '  Sam Lee  ' });
	await outsider.mutation(api.users.setDisplayName, { displayName: 'Outsider' });
	await expect(t.query(api.teams.listMembers)).resolves.toBeNull();
	await expect(outsider.query(api.teams.listMembers)).resolves.toBeNull();
	await outsider.mutation(api.teams.create, { name: 'Other team' });
	const teamId = await admin.mutation(api.teams.create, { name: 'Robodogs' });
	const membershipId = await t.run((ctx) => ctx.db.insert('memberships', { userId, teamId, role: 'member' }));
	await expect(member.query(api.teams.listMembers)).resolves.toMatchObject({
		canPromote: false,
		members: [
			{ role: 'admin', displayName: 'Sam Lee', isYou: false },
			{ id: membershipId, role: 'member', displayName: 'Sam Lee', isYou: true },
		],
	});

	const replacement = await t.run(async (ctx) => {
		await ctx.db.delete('memberships', membershipId);
		return ctx.db.insert('memberships', { userId, teamId, role: 'member' });
	});
	await expect(admin.mutation(api.teams.promote, { membershipId })).rejects.toThrow('not a member');
	await admin.mutation(api.teams.promote, { membershipId: replacement });
	await member.mutation(api.users.setDisplayName, { displayName: 'Sam (drive team)' });
	await expect(member.query(api.teams.listMembers)).resolves.toMatchObject({
		canPromote: true,
		members: [
			{ role: 'admin', displayName: 'Sam Lee', isYou: false },
			{ id: replacement, role: 'admin', displayName: 'Sam (drive team)', isYou: true },
		],
	});
});

const bytes = (length: number) => new Uint8Array(length).fill(7).buffer;

async function signInWithKey(t: TestConvex<typeof schema>) {
	const account = await signIn(t);
	await t.run((ctx) =>
		ctx.db.patch('users', account.userId, {
			encryptionKey: { publicKey: bytes(8), signature: bytes(8) },
		}),
	);
	return account;
}

test('pairing messages are relayed once, in order, and only within one account', async () => {
	const t = setup();
	const { client: keyless } = await signIn(t);
	const { client: account } = await signInWithKey(t);
	const { client: other } = await signInWithKey(t);
	const respond = { publicKey: bytes(65), commitment: bytes(32) };
	const nonce = { nonce: bytes(16) };
	const credential = { iv: bytes(12), ciphertext: bytes(1810) };

	await expect(keyless.mutation(api.pairings.start, { publicKey: bytes(65) })).rejects.toThrow('encryption key');
	await expect(account.mutation(api.pairings.start, { publicKey: bytes(64) })).rejects.toThrow('Invalid');
	const stale = await account.mutation(api.pairings.start, { publicKey: bytes(65) });
	const id = await account.mutation(api.pairings.start, { publicKey: bytes(65) });
	await expect(account.mutation(api.pairings.respond, { id: stale, ...respond })).rejects.toThrow('ended');
	await expect(other.query(api.pairings.getMine)).resolves.toBeNull();
	await expect(other.mutation(api.pairings.respond, { id, ...respond })).rejects.toThrow('ended');
	await other.mutation(api.pairings.cancel, { id });

	await expect(account.mutation(api.pairings.revealNewDeviceNonce, { id, ...nonce })).rejects.toThrow('continue');
	await account.mutation(api.pairings.respond, { id, ...respond });
	await expect(account.mutation(api.pairings.respond, { id, ...respond })).rejects.toThrow('continue');
	await expect(account.mutation(api.pairings.revealApproverNonce, { id, ...nonce })).rejects.toThrow('continue');
	await account.mutation(api.pairings.revealNewDeviceNonce, { id, ...nonce });
	await expect(account.mutation(api.pairings.sendCredential, { id, credential })).rejects.toThrow('continue');
	await account.mutation(api.pairings.revealApproverNonce, { id, ...nonce });
	await account.mutation(api.pairings.sendCredential, { id, credential });
	await expect(account.mutation(api.pairings.sendCredential, { id, credential })).rejects.toThrow('continue');
	await expect(account.query(api.pairings.getMine)).resolves.toMatchObject({ id, credential });

	await account.mutation(api.pairings.cancel, { id });
	await expect(account.query(api.pairings.getMine)).resolves.toBeNull();
});

test('pairing attempts expire', async () => {
	vi.useFakeTimers();
	try {
		const t = setup();
		const { client } = await signInWithKey(t);
		const id = await client.mutation(api.pairings.start, { publicKey: bytes(65) });
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		await expect(client.query(api.pairings.getMine)).resolves.toBeNull();
		await expect(
			client.mutation(api.pairings.respond, { id, publicKey: bytes(65), commitment: bytes(32) }),
		).rejects.toThrow('ended');
	} finally {
		vi.useRealTimers();
	}
});

test('ending a membership drops its grants and the remaining members rotate to a fresh key', async () => {
	const t = setup();
	const signer = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
	const signingKey = new Uint8Array(await crypto.subtle.exportKey('pkcs8', signer.privateKey));
	vi.stubEnv('ATTESTATION_PRIVATE_KEY', btoa(String.fromCharCode(...signingKey)));
	const admin = await signIn(t);
	const driver = await signIn(t);
	const removed = await signIn(t);
	const [adminKey, driverKey] = await Promise.all([registerKey(admin), registerKey(driver), registerKey(removed)]);
	const trustedCloudKey = (await admin.client.query(api.users.getAttestationKey))!;
	const teamId = await admin.client.mutation(api.teams.create, { name: 'Robodogs' });
	const removedMembership = await t.run(async (ctx) => {
		await ctx.db.patch('teams', teamId, { keyVersion: 1 });
		const ids = [];
		for (const account of [admin, driver, removed]) {
			await ctx.db.insert('teamKeys', { teamId, userId: account.userId, keyVersion: 1, wrappedKey: bytes(384) });
			if (account !== admin) {
				ids.push(await ctx.db.insert('memberships', { userId: account.userId, teamId, role: 'member' }));
			}
		}
		return ids[1]!;
	});

	await expect(driver.client.mutation(api.teams.removeMember, { membershipId: removedMembership })).rejects.toThrow(
		'Only team admins',
	);
	const adminMembership = (await admin.client.query(api.teams.listMembers))!.members.find((member) => member.isYou)!;
	await expect(admin.client.mutation(api.teams.removeMember, { membershipId: adminMembership.id })).rejects.toThrow(
		'Leave the team instead',
	);
	await expect(admin.client.query(api.teams.getMine)).resolves.toMatchObject({ canLeave: false });
	await expect(admin.client.mutation(api.teams.leave)).rejects.toThrow('another member an admin');
	await admin.client.mutation(api.teams.removeMember, { membershipId: removedMembership });
	await expect(removed.client.query(api.teams.getMine)).resolves.toBeNull();
	await expect(removed.client.query(api.teamKeys.getMine)).resolves.toBeNull();

	const pending = (await driver.client.query(api.teamKeys.getMine))!;
	expect(pending.keyVersion).toBe(1);
	expect(pending.rotation?.recipients.map(({ userId }) => userId).sort()).toEqual([admin.userId, driver.userId].sort());
	const grantsFor = async (recipients: (typeof admin)[], keyVersion = 2) => {
		const teamKey = crypto.getRandomValues(new Uint8Array(32)).buffer;
		const grants = await Promise.all(
			recipients.map(async ({ userId, client }) => ({
				userId,
				wrappedKey: await wrapTeamKey(
					teamKey,
					{ teamId, recipientId: userId, keyVersion },
					(await client.query(api.users.getMyEncryptionKey))!,
					trustedCloudKey,
				),
			})),
		);
		return { keyVersion, grants };
	};
	await expect(admin.client.mutation(api.teamKeys.rotate, await grantsFor([admin, driver, removed]))).rejects.toThrow(
		'members changed',
	);
	await expect(admin.client.mutation(api.teamKeys.rotate, await grantsFor([admin]))).rejects.toThrow('members changed');
	await expect(admin.client.mutation(api.teamKeys.rotate, await grantsFor([admin, driver], 3))).rejects.toThrow(
		'key changed',
	);
	await expect(removed.client.mutation(api.teamKeys.rotate, await grantsFor([admin, driver]))).rejects.toThrow(
		'key changed',
	);
	const outcomes = await Promise.allSettled(
		[admin, driver].map(async ({ client }) => client.mutation(api.teamKeys.rotate, await grantsFor([admin, driver]))),
	);
	expect(outcomes.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);

	const unwrap = async (account: typeof admin, privateKey: CryptoKey) => {
		const grant = (await account.client.query(api.teamKeys.getMine))!;
		expect(grant).toMatchObject({ keyVersion: 2, rotation: null });
		return unwrapTeamKey(grant.wrappedKey!, { teamId, recipientId: account.userId, keyVersion: 2 }, privateKey);
	};
	expect(await unwrap(admin, adminKey)).toEqual(await unwrap(driver, driverKey));
	await expect(t.run((ctx) => ctx.db.query('teamKeys').collect())).resolves.toHaveLength(4);

	await driver.client.mutation(api.teams.leave);
	await expect(driver.client.query(api.teams.getMine)).resolves.toBeNull();
	await expect(admin.client.query(api.teamKeys.getMine)).resolves.toMatchObject({
		keyVersion: 2,
		rotation: { recipients: [{ userId: admin.userId }] },
	});
	await expect(admin.client.mutation(api.teams.leave)).rejects.toThrow('only member');
});

test('dashboard updates are ordered per team, gated on membership and key version, and replaced by snapshots', async () => {
	const t = setup();
	const admin = await signIn(t);
	const member = await signIn(t);
	const outsider = await signIn(t);
	const teamId = await admin.client.mutation(api.teams.create, { name: 'Robodogs' });
	await outsider.client.mutation(api.teams.create, { name: 'Space Dogs' });
	const memberMembership = await t.run(async (ctx) => {
		await ctx.db.patch('teams', teamId, { keyVersion: 1 });
		return ctx.db.insert('memberships', { userId: member.userId, teamId, role: 'member' });
	});
	const adminMembership = (await t.run((ctx) =>
		ctx.db
			.query('memberships')
			.withIndex('by_user', (q) => q.eq('userId', admin.userId))
			.unique(),
	))!._id;
	const update = (ciphertext: number, extra: object = {}) => ({
		membershipId: adminMembership,
		dashboardId: 'dash',
		keyVersion: 1,
		iv: bytes(12),
		ciphertext: new Uint8Array([ciphertext]).buffer,
		...extra,
	});

	await expect(admin.client.mutation(api.cloudDashboards.push, update(1, { iv: bytes(8) }))).rejects.toThrow('Invalid');
	await expect(admin.client.mutation(api.cloudDashboards.push, update(1, { keyVersion: 2 }))).rejects.toThrow(
		'key changed',
	);
	await expect(
		member.client.mutation(api.cloudDashboards.push, update(1, { membershipId: adminMembership })),
	).rejects.toThrow('no longer on the team');
	await expect(admin.client.mutation(api.cloudDashboards.push, update(1))).resolves.toBe(1);
	await expect(
		member.client.mutation(api.cloudDashboards.push, update(2, { membershipId: memberMembership })),
	).resolves.toBe(2);
	await expect(admin.client.mutation(api.cloudDashboards.push, update(3))).resolves.toBe(3);
	await expect(member.client.query(api.cloudDashboards.list)).resolves.toEqual([
		{ dashboardId: 'dash', seq: 3, compactedSeq: null, compactedKeyVersion: null },
	]);
	await expect(outsider.client.query(api.cloudDashboards.list)).resolves.toEqual([]);
	await expect(outsider.client.query(api.cloudDashboards.pull, { dashboardId: 'dash', after: 0 })).resolves.toBeNull();
	const pulled = await member.client.query(api.cloudDashboards.pull, { dashboardId: 'dash', after: 1 });
	expect(pulled?.map(({ seq, ciphertext }) => [seq, new Uint8Array(ciphertext)[0]])).toEqual([
		[2, 2],
		[3, 3],
	]);

	// A snapshot that missed update 3 keeps it and doesn't count as compacted
	await admin.client.mutation(api.cloudDashboards.push, update(4, { replacesThrough: 2 }));
	await expect(member.client.query(api.cloudDashboards.list)).resolves.toMatchObject([{ seq: 4, compactedSeq: null }]);
	await admin.client.mutation(api.cloudDashboards.push, update(5, { replacesThrough: 4 }));
	await expect(member.client.query(api.cloudDashboards.list)).resolves.toMatchObject([
		{ seq: 5, compactedSeq: 5, compactedKeyVersion: 1 },
	]);
	const compacted = await member.client.query(api.cloudDashboards.pull, { dashboardId: 'dash', after: 0 });
	expect(compacted?.map(({ seq }) => seq)).toEqual([5]);

	// Rotation pending after a removal blocks uploads under the old key, and the removed account's edits stay out
	await admin.client.mutation(api.teams.removeMember, { membershipId: memberMembership });
	await expect(admin.client.mutation(api.cloudDashboards.push, update(5))).rejects.toThrow('key changed');
	await expect(
		member.client.mutation(api.cloudDashboards.push, update(5, { membershipId: memberMembership })),
	).rejects.toThrow('no longer on the team');
	await expect(member.client.query(api.cloudDashboards.pull, { dashboardId: 'dash', after: 0 })).resolves.toBeNull();
	const rejoined = await t.run((ctx) =>
		ctx.db.insert('memberships', { userId: member.userId, teamId, role: 'member' }),
	);
	await expect(
		member.client.mutation(api.cloudDashboards.push, update(5, { membershipId: memberMembership })),
	).rejects.toThrow('no longer on the team');
	expect(rejoined).not.toBe(memberMembership);

	await t.run((ctx) => ctx.db.delete('memberships', rejoined));
	await admin.client.mutation(api.teams.remove, { teamId });
	await expect(t.run((ctx) => ctx.db.query('dashboardUpdates').collect())).resolves.toEqual([]);
	await expect(t.run((ctx) => ctx.db.query('cloudDashboards').collect())).resolves.toEqual([]);
});
