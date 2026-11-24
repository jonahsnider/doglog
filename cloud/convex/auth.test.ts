import { registerGoogleOauth } from '@convex-dev/auth/components/google/test';
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vite-plus/test';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const studioOrigin = 'https://studio.example.test';

afterEach(() => vi.unstubAllEnvs());

test('Google sign-in requests only identity and returns only to Studio', async () => {
	vi.stubEnv('STUDIO_ORIGIN', studioOrigin);
	vi.stubEnv('CONVEX_SITE_URL', 'https://cloud.example.test/oauth/google');
	vi.stubEnv('CLIENT_ID', 'test-client');
	const t = convexTest(schema, modules);
	registerGoogleOauth(t);

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
