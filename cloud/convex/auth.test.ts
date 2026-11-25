import { registerGoogleOauth } from '@convex-dev/auth/components/google/test';
import { registerCore, sessionIdentity } from '@convex-dev/auth/test';
import { convexTest, type TestConvex } from 'convex-test';
import type { FunctionReference } from 'convex/server';
import { afterEach, expect, test, vi } from 'vite-plus/test';
import passkeySchema from '../node_modules/@convex-dev/auth/src/components/passkey/schema.ts';
// Not exported, the provider callback normally encrypts the ticket after exchanging the code with Google
import { encryptTicketPayload } from '../node_modules/@convex-dev/auth/src/lib/oauth/crypto.ts';
import { api, components } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const studioOrigin = 'https://studio.example.test';

afterEach(() => vi.unstubAllEnvs());

function setup() {
	vi.stubEnv('STUDIO_ORIGIN', studioOrigin);
	vi.stubEnv('CONVEX_CLOUD_URL', 'https://convex.example.test');
	vi.stubEnv('CONVEX_SITE_URL', 'https://cloud.example.test/oauth/google');
	vi.stubEnv('CLIENT_ID', 'test-client');
	const t = convexTest(schema, modules);
	registerCore(t);
	registerGoogleOauth(t);
	// Without `registerPasskey`, which also registers a batch worker these tests don't use
	t.registerComponent(
		'authPasskey',
		passkeySchema,
		import.meta.glob('../node_modules/@convex-dev/auth/src/components/passkey/**/*.ts'),
	);
	return t;
}

// Internal to the component, so its generated API leaves them out
const googleCallback = components.authGoogle.provider as unknown as Record<
	'claimAuthorizationRequest' | 'createTicket',
	FunctionReference<'mutation', 'internal'>
>;

async function sha256Hex(text: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Runs Google's side of a flow `state` started, returning the code the callback would redirect back with */
async function finishAtGoogle(t: TestConvex<typeof schema>, state: string, googleAccountId: string) {
	const code = crypto.randomUUID();
	const encryptedPayload = await encryptTicketPayload(code, JSON.stringify({ claims: { sub: googleAccountId } }));
	await t.mutation(googleCallback.claimAuthorizationRequest, {
		stateHash: await sha256Hex(state),
	});
	await t.mutation(googleCallback.createTicket, {
		stateHash: await sha256Hex(state),
		ticketCodeHash: await sha256Hex(code),
		encryptedPayload,
	});
	return code;
}

async function signInWithGoogle(t: TestConvex<typeof schema>, googleAccountId: string) {
	const { state } = await t.mutation(api.auth.startSignInWithGoogle, { redirectTo: `${studioOrigin}/cloud` });
	const code = await finishAtGoogle(t, state, googleAccountId);
	const result = await t.mutation(api.auth.completeSignInWithGoogle, { code, state });
	if (result.status !== 'complete') {
		throw new Error('Google sign-in failed');
	}
	return result.tokens;
}

async function createPasskeyOnlyAccount(t: TestConvex<typeof schema>) {
	const userId = await t.run((ctx) => ctx.db.insert('users', { displayName: 'Ada' }));
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

test('Google sign-in requests only identity and returns only to Studio', async () => {
	const t = setup();

	const { redirect } = await t.mutation(api.auth.startSignInWithGoogle, {
		redirectTo: `${studioOrigin}/desktop-sign-in?key=test-key`,
	});
	const url = new URL(redirect);
	expect(url.origin).toBe('https://accounts.google.com');
	expect(url.searchParams.get('redirect_uri')).toBe('https://cloud.example.test/oauth/google/callback');
	expect(url.searchParams.get('scope')).toBe('openid');
	await expect(
		t.mutation(api.auth.startSignInWithGoogle, { redirectTo: 'https://other.example.test/cloud' }),
	).rejects.toThrow('not in allowedRedirectOrigins');
});

test('a linked Google account signs in to the account that linked it', async () => {
	const t = setup();
	const { userId, client } = await createPasskeyOnlyAccount(t);
	const { state } = await client.mutation(api.auth.startLinkingGoogle, { redirectTo: `${studioOrigin}/cloud` });
	// The browser comes back from Google before the old session loads, so it finishes without one
	const code = await finishAtGoogle(t, state, 'google-ada');
	const linked = await t.mutation(api.auth.completeLinkingGoogle, { code, state });
	expect(linked).toMatchObject({ status: 'complete', tokens: { userId } });
	await expect(t.run((ctx) => ctx.db.get('users', userId))).resolves.toMatchObject({ google: true });

	await expect(signInWithGoogle(t, 'google-ada')).resolves.toMatchObject({ userId });
	await expect(t.run((ctx) => ctx.db.query('users').collect())).resolves.toHaveLength(1);
});

test('a Google account that signs in to another Cloud account is not linked', async () => {
	const t = setup();
	const other = await signInWithGoogle(t, 'google-shared');
	const { userId, client } = await createPasskeyOnlyAccount(t);
	const { state } = await client.mutation(api.auth.startLinkingGoogle, { redirectTo: `${studioOrigin}/cloud` });
	const code = await finishAtGoogle(t, state, 'google-shared');
	await expect(t.mutation(api.auth.completeLinkingGoogle, { code, state })).rejects.toThrow(
		'That Google account already signs in to a different Cloud account.',
	);
	await expect(t.run((ctx) => ctx.db.get('users', userId))).resolves.not.toHaveProperty('google');
	await expect(signInWithGoogle(t, 'google-shared')).resolves.toMatchObject({ userId: other.userId });
});

test('Google sign-ins that aren’t linking still create a new account', async () => {
	const t = setup();
	const { client } = await createPasskeyOnlyAccount(t);
	// Another browser's link that never finished
	await client.mutation(api.auth.startLinkingGoogle, { redirectTo: `${studioOrigin}/cloud` });
	const tokens = await signInWithGoogle(t, 'google-new');
	const users = await t.run((ctx) => ctx.db.query('users').collect());
	expect(users).toHaveLength(2);
	expect(users.find((user) => user._id === tokens.userId)).toMatchObject({ google: true });
});

test('unlinking Google frees it for another account', async () => {
	const t = setup();
	const { userId, client } = await createPasskeyOnlyAccount(t);
	await t.run((ctx) => ctx.db.patch('users', userId, { apple: true }));
	const { state } = await client.mutation(api.auth.startLinkingGoogle, { redirectTo: `${studioOrigin}/cloud` });
	await t.mutation(api.auth.completeLinkingGoogle, { code: await finishAtGoogle(t, state, 'google-ada'), state });

	await client.mutation(api.users.unlink, { provider: 'google' });
	await expect(client.query(api.users.getSignInMethods)).resolves.toEqual({ passkeys: [], apple: true, google: false });
	const tokens = await signInWithGoogle(t, 'google-ada');
	expect(tokens.userId).not.toBe(userId);
});

test('an account’s last way to sign in can’t be removed', async () => {
	const t = setup();
	const tokens = await signInWithGoogle(t, 'google-only');
	const client = t.withIdentity(sessionIdentity(tokens));
	await expect(client.mutation(api.users.unlink, { provider: 'google' })).rejects.toThrow(
		'Add another way to sign in before removing this one.',
	);
	await expect(signInWithGoogle(t, 'google-only')).resolves.toMatchObject({ userId: tokens.userId });
});
