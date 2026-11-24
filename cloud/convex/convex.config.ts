import authApple from '@convex-dev/auth/components/apple/convex.config.js';
import auth from '@convex-dev/auth/convex.config.js';
import passkey from '@convex-dev/auth/components/passkey/convex.config.js';
import username from '@convex-dev/auth/components/username/convex.config.js';
import { defineApp } from 'convex/server';
import { v } from 'convex/values';

const app = defineApp({
	env: {
		STUDIO_ORIGIN: v.string(),
		// Base64-encoded PKCS#8 P-256 key. Use a separate signing key per deployment.
		// openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -outform DER | openssl base64 -A
		ATTESTATION_PRIVATE_KEY: v.optional(v.string()),
		// Sign in with Apple: the deployment's Services ID, the developer team, and its own key's ID and `.p8` contents
		AUTH_APPLE_CLIENT_ID: v.string(),
		AUTH_APPLE_TEAM_ID: v.string(),
		AUTH_APPLE_KEY_ID: v.string(),
		AUTH_APPLE_PRIVATE_KEY: v.string(),
	},
});

app.use(auth);
app.use(passkey);
app.use(username);
app.use(authApple, {
	httpPrefix: '/oauth/apple',
	env: {
		CLIENT_ID: app.env.AUTH_APPLE_CLIENT_ID,
		TEAM_ID: app.env.AUTH_APPLE_TEAM_ID,
		KEY_ID: app.env.AUTH_APPLE_KEY_ID,
		PRIVATE_KEY: app.env.AUTH_APPLE_PRIVATE_KEY,
	},
});

export default app;
