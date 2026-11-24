import { setupUsernamePasskey } from '@convex-dev/auth/methods/username-passkey/server';
import { setupConvexAuth } from '@convex-dev/auth/server';
import { components, internal } from './_generated/api';
import { env } from './_generated/server';

const studioUrl = new URL(env.STUDIO_ORIGIN);
const auth = setupConvexAuth({ component: components.auth });

export const { isAuthenticated, refreshSession, signOut } = auth;

export const {
	startSignInWithUsernamePasskey,
	startAutofillSignInWithUsernamePasskey,
	finishSignUpWithUsernamePasskey,
	finishSignInWithUsernamePasskey,
} = setupUsernamePasskey(auth, {
	component: components.authPasskey,
	usernameComponent: components.authUsername,
	rpId: studioUrl.hostname,
	origin: studioUrl.origin,
}).attachUserCallbacks({ createUser: internal.users.create });
