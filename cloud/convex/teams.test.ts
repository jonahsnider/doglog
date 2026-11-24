import { registerCore, sessionIdentity } from '@convex-dev/auth/test';
import { convexTest, type TestConvex } from 'convex-test';
import { afterEach, expect, test, vi } from 'vite-plus/test';
import { api, components, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const method = { name: 'usernamePasskey', profile: {} } as const;

afterEach(() => vi.unstubAllEnvs());

function setup() {
	vi.stubEnv('CONVEX_CLOUD_URL', 'https://convex.example.test');
	const t = convexTest(schema, modules);
	registerCore(t);
	return t;
}

async function signIn(t: TestConvex<typeof schema>) {
	const userId = await t.mutation(internal.users.create, { method });
	const tokens = await t.mutation(components.auth.public._internal_dangerous_signIn, {
		userId,
		componentPath: 'authPasskey',
		claims: { method: method.name, profile: method.profile },
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
	await expect(client.query(api.users.getCurrent)).resolves.toEqual({ id: userId });
	const attempts = ['Robodogs', 'Space Dogs'].map(async (name) => ({
		id: await client.mutation(api.teams.create, { name }),
		name,
		role: 'admin',
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
	await expect(alice.query(api.teams.getMine)).resolves.toEqual({ id: aliceTeam, name: 'Robodogs', role: 'admin' });
	await expect(bob.query(api.teams.getMine)).resolves.toEqual({ id: bobTeam, name: 'Space Dogs', role: 'admin' });
});
