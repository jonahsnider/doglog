import { registerCore, sessionIdentity } from '@convex-dev/auth/test';
import { convexTest, type TestConvex } from 'convex-test';
import { afterEach, expect, test, vi } from 'vite-plus/test';
import { api, components } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

afterEach(() => vi.unstubAllEnvs());
const bytes = (length: number, fill = 7) => new Uint8Array(length).fill(fill).buffer;

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

/** A team with a key at version 1 held by an admin and a member */
async function setupTeam() {
	vi.stubEnv('CONVEX_CLOUD_URL', 'https://convex.example.test');
	const t = convexTest(schema, modules);
	registerCore(t);
	const admin = await signIn(t);
	const member = await signIn(t);
	const outsider = await signIn(t);
	const teamId = await admin.client.mutation(api.teams.create, { name: 'Robodogs' });
	const memberId = await t.run(async (ctx) => {
		await ctx.db.patch('teams', teamId, { keyVersion: 1 });
		for (const account of [admin, member]) {
			await ctx.db.insert('teamKeys', { teamId, userId: account.userId, keyVersion: 1, wrappedKey: bytes(384) });
		}
		return ctx.db.insert('memberships', { userId: member.userId, teamId, role: 'member' });
	});
	return { t, teamId, admin, member, memberId, outsider };
}

test('only admins holding the current key save the connection, and only members read it', async () => {
	const { admin, member, outsider } = await setupTeam();
	const connection = { keyVersion: 1, iv: bytes(12), ciphertext: bytes(200) };
	await expect(member.client.mutation(api.storage.save, connection)).rejects.toThrow('Only team admins');
	await expect(admin.client.mutation(api.storage.save, { ...connection, keyVersion: 2 })).rejects.toThrow(
		'team key changed',
	);
	await admin.client.mutation(api.storage.save, connection);
	await expect(member.client.query(api.storage.get)).resolves.toEqual(connection);
	await expect(outsider.client.query(api.storage.get)).resolves.toBeNull();

	await expect(member.client.mutation(api.storage.remove)).rejects.toThrow('Only team admins');
	await admin.client.mutation(api.storage.remove);
	await expect(member.client.query(api.storage.get)).resolves.toBeNull();
});

test('a removed member loses the connection, and the rest re-encrypt it with the rotated key once', async () => {
	const { t, teamId, admin, member, memberId } = await setupTeam();
	await admin.client.mutation(api.storage.save, { keyVersion: 1, iv: bytes(12), ciphertext: bytes(200) });
	await admin.client.mutation(api.teams.removeMember, { membershipId: memberId });
	await expect(member.client.query(api.storage.get)).resolves.toBeNull();

	const rotated = { fromKeyVersion: 1, keyVersion: 2, iv: bytes(12, 1), ciphertext: bytes(200, 1) };
	// Before the rotation is published, nobody holds key 2
	await expect(admin.client.mutation(api.storage.reencrypt, rotated)).rejects.toThrow('team key changed');
	await t.run(async (ctx) => {
		await ctx.db.patch('teams', teamId, { keyVersion: 2, rotationPending: undefined });
		await ctx.db.insert('teamKeys', { teamId, userId: admin.userId, keyVersion: 2, wrappedKey: bytes(384) });
	});
	await admin.client.mutation(api.storage.reencrypt, rotated);
	// A second Studio that re-encrypted from the same version doesn't replace the first one's copy
	await admin.client.mutation(api.storage.reencrypt, { ...rotated, iv: bytes(12, 2), ciphertext: bytes(200, 2) });
	await expect(admin.client.query(api.storage.get)).resolves.toEqual({
		keyVersion: 2,
		iv: rotated.iv,
		ciphertext: rotated.ciphertext,
	});
});
