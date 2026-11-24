import { setupApple } from '@convex-dev/auth/methods/apple/server';
import { setupGoogle } from '@convex-dev/auth/methods/google/server';
import type { WireCreationOptions, WireRequestOptions } from '@convex-dev/auth/methods/username-passkey/react-custom';
import { setupConvexAuth } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { components, internal } from './_generated/api';
import { env, mutation } from './_generated/server';
import { normalizeDisplayName } from './users';

const studioUrl = new URL(env.STUDIO_ORIGIN);
const auth = setupConvexAuth({ component: components.auth });

export const { isAuthenticated, refreshSession, signOut } = auth;

const passkey = components.authPasskey;
const passkeySignInPurpose = 'passkey:signIn';
const passkeyTimeout = 9 * 60 * 1000;
const expectedSite = { expectedRpId: studioUrl.hostname, expectedOrigin: studioUrl.origin };
// Convex Auth 2.1 only ships a username-first recipe, so compose its passkey component directly.
const bindPasskey = auth.bindMethod<'passkey', { displayName?: string }>;
const { authMutation }: ReturnType<typeof bindPasskey> = bindPasskey({
	name: 'passkey',
	createUser: internal.users.createWithPasskey,
});

const credential = { id: v.string(), rawId: v.string(), type: v.literal('public-key') };

function base64Url(bytes: ArrayBuffer) {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

export const startPasskeySignUp = mutation({
	args: { displayName: v.string() },
	handler: async (ctx, args) => {
		const displayName = normalizeDisplayName(args.displayName);
		const { challenge, userHandle } = await ctx.runMutation(passkey.registration.startRegistrationForNewUser, {});
		return {
			rp: { id: studioUrl.hostname, name: 'DogLog Studio' },
			user: { id: base64Url(userHandle), name: displayName, displayName },
			challenge: base64Url(challenge),
			pubKeyCredParams: [-7, -257].map((alg) => ({ type: 'public-key', alg })),
			timeout: passkeyTimeout,
			excludeCredentials: [],
			authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
			attestation: 'none',
			extensions: {},
		} satisfies WireCreationOptions;
	},
});

export const finishPasskeySignUp = authMutation({
	args: {
		displayName: v.string(),
		response: v.object({
			...credential,
			response: v.object({
				clientDataJSON: v.string(),
				attestationObject: v.string(),
				transports: v.optional(v.array(v.string())),
			}),
		}),
	},
	handler: async (ctx, args) => {
		const displayName = normalizeDisplayName(args.displayName);
		const registration = { ...expectedSite, response: { ...args.response, clientExtensionResults: {} } };
		const checked = await ctx.runQuery(passkey.registration.checkRegistrationForNewUser, registration);
		if (!checked.success) {
			return { status: 'error', userError: checked.userError } as const;
		}

		const tokens = await ctx.convexAuth.completeSignUp({ profile: { displayName }, authenticatedBy: passkey });
		const saved = await ctx.runMutation(passkey.registration._internal_dangerous_finishRegistrationForNewUser, {
			...registration,
			newUserId: tokens.userId,
		});
		if (!saved.success) {
			// Throw to roll back the account and session if the credential was not saved.
			throw new Error(`Could not save the new passkey: ${saved.userError.error}`);
		}
		return { status: 'complete', tokens } as const;
	},
});

export const startPasskeySignIn = mutation({
	args: {},
	handler: async (ctx) => {
		const { challenge } = await ctx.runMutation(passkey.authentication.startAuthentication, {
			purpose: passkeySignInPurpose,
		});
		return {
			rpId: studioUrl.hostname,
			challenge: base64Url(challenge),
			timeout: passkeyTimeout,
			allowCredentials: [],
			userVerification: 'required',
		} satisfies WireRequestOptions;
	},
});

export const finishPasskeySignIn = authMutation({
	args: {
		response: v.object({
			...credential,
			response: v.object({
				clientDataJSON: v.string(),
				authenticatorData: v.string(),
				signature: v.string(),
				userHandle: v.optional(v.union(v.string(), v.null())),
			}),
		}),
	},
	handler: async (ctx, args) => {
		const verified = await ctx.runMutation(passkey.authentication.finishAuthentication, {
			...expectedSite,
			purpose: passkeySignInPurpose,
			response: {
				...args.response,
				response: { ...args.response.response, userHandle: args.response.response.userHandle ?? undefined },
				clientExtensionResults: {},
			},
		});
		if (!verified.success) {
			return { status: 'error', userError: verified.userError } as const;
		}
		const tokens = await ctx.convexAuth.completeSignIn({
			userId: verified.userId,
			profile: {},
			authenticatedBy: passkey,
		});
		return { status: 'complete', tokens } as const;
	},
});

export const { startSignInWithApple, completeSignInWithApple } = setupApple(auth, {
	component: components.authApple,
	allowedRedirectOrigins: [studioUrl.origin],
}).attachUserCallbacks({ createUser: internal.users.createWithApple });

export const { startSignInWithGoogle, completeSignInWithGoogle } = setupGoogle(auth, {
	component: components.authGoogle,
	allowedRedirectOrigins: [studioUrl.origin],
}).attachUserCallbacks({ createUser: internal.users.createWithGoogle });
