import { setupApple } from '@convex-dev/auth/methods/apple/server';
import type { SignInComplete, SignInError } from '@convex-dev/auth';
import { setupGoogle } from '@convex-dev/auth/methods/google/server';
import { defaultPasskeyName } from '@convex-dev/auth/methods/username-passkey/aaguids';
import type { WireCreationOptions, WireRequestOptions } from '@convex-dev/auth/methods/username-passkey/react-custom';
import { getAuthUserId, setupConvexAuth } from '@convex-dev/auth/server';
import type { FunctionReference } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { api, components, internal } from './_generated/api';
import { env, type MutationCtx, mutation } from './_generated/server';
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
const registrationResponse = v.object({
	...credential,
	response: v.object({
		clientDataJSON: v.string(),
		attestationObject: v.string(),
		transports: v.optional(v.array(v.string())),
	}),
});

function base64Url(bytes: ArrayBuffer) {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

function creationOptions(
	registration: {
		challenge: ArrayBuffer;
		userHandle: ArrayBuffer;
		excludeCredentials: { id: ArrayBuffer; transports?: string[] }[];
	},
	name: string,
): WireCreationOptions {
	return {
		rp: { id: studioUrl.hostname, name: 'DogLog Studio' },
		user: { id: base64Url(registration.userHandle), name, displayName: name },
		challenge: base64Url(registration.challenge),
		pubKeyCredParams: [-7, -257].map((alg) => ({ type: 'public-key', alg })),
		timeout: passkeyTimeout,
		excludeCredentials: registration.excludeCredentials.map(({ id, transports }) => ({
			id: base64Url(id),
			type: 'public-key',
			...(transports && { transports }),
		})),
		authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
		attestation: 'none',
		extensions: {},
	};
}

async function requireUser(ctx: MutationCtx) {
	const userId = await getAuthUserId(ctx);
	const user = userId ? await ctx.db.get('users', userId) : null;
	if (!user) {
		throw new ConvexError('Sign in to add a way to sign in.');
	}
	return user;
}

export const startPasskeySignUp = mutation({
	args: { displayName: v.string() },
	handler: async (ctx, args) => {
		const displayName = normalizeDisplayName(args.displayName);
		const { challenge, userHandle } = await ctx.runMutation(passkey.registration.startRegistrationForNewUser, {});
		return creationOptions({ challenge, userHandle, excludeCredentials: [] }, displayName);
	},
});

export const finishPasskeySignUp = authMutation({
	args: { displayName: v.string(), response: registrationResponse },
	handler: async (ctx, args) => {
		const displayName = normalizeDisplayName(args.displayName);
		const response = { ...args.response, clientExtensionResults: {} };
		// The passkey provider's name, ex. Google Password Manager, from its AAGUID
		const registration = { ...expectedSite, response, name: defaultPasskeyName(response) };
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

// Adding a passkey to an account needs no other passkey, unlike Convex Auth's username recipe, since the account may
// only have Apple or Google
export const startAddingPasskey = mutation({
	args: {},
	handler: async (ctx): Promise<WireCreationOptions> => {
		const user = await requireUser(ctx);
		const registration = await ctx.runMutation(passkey.registration.startRegistrationForExistingUser, {
			verifiedUserId: user._id,
		});
		// Passkey managers list the passkey under this name
		return creationOptions(registration, user.displayName ?? 'DogLog Cloud account');
	},
});

export const finishAddingPasskey = mutation({
	args: { response: registrationResponse },
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		const response = { ...args.response, clientExtensionResults: {} };
		const saved = await ctx.runMutation(passkey.registration._internal_dangerous_finishRegistrationForExistingUser, {
			...expectedSite,
			verifiedUserId: user._id,
			response,
			name: defaultPasskeyName(response),
		});
		return saved.success ? null : saved.userError;
	},
});

async function sha256Hex(text: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

type StartOauth = FunctionReference<'mutation', 'public', { redirectTo: string }, { redirect: string; state: string }>;
type CompleteOauth = FunctionReference<
	'mutation',
	'public',
	{ code: string; state: string },
	SignInComplete | SignInError<{ error: 'INVALID_CODE' }>
>;

// Linking Apple or Google runs the provider's own sign-in, remembering which account started it under the flow's state
async function startLinking(
	ctx: MutationCtx,
	start: StartOauth,
	redirectTo: string,
): Promise<StartOauth['_returnType']> {
	const user = await requireUser(ctx);
	const earlier = ctx.db.query('oauthLinks').withIndex('by_user', (q) => q.eq('userId', user._id));
	for await (const link of earlier) {
		await ctx.db.delete('oauthLinks', link._id);
	}
	const started = await ctx.runMutation(start, { redirectTo });
	await ctx.db.insert('oauthLinks', { userId: user._id, stateHash: await sha256Hex(started.state) });
	return started;
}

/**
 * Finishes the provider's sign-in as the account that started linking. For an identity the provider hasn't seen, its
 * `createUser` callback finds the link marked `finishing` and returns that account instead of a new one. The mark is
 * removed before this transaction commits, so the callback never sees another sign-in's link.
 */
async function finishLinking(
	ctx: MutationCtx,
	complete: CompleteOauth,
	provider: 'apple' | 'google',
	args: { code: string; state: string },
): Promise<CompleteOauth['_returnType']> {
	const stateHash = await sha256Hex(args.state);
	const link = await ctx.db
		.query('oauthLinks')
		.withIndex('by_state_hash', (q) => q.eq('stateHash', stateHash))
		.unique();
	if (!link) {
		throw new ConvexError('Couldn’t finish linking. Start again from the Cloud page.');
	}
	await ctx.db.patch('oauthLinks', link._id, { finishing: true });
	const result = await ctx.runMutation(complete, args);
	await ctx.db.delete('oauthLinks', link._id);
	if (result.status === 'complete') {
		if (result.tokens.userId !== link.userId) {
			// Rolls back the other account's session
			throw new ConvexError(
				`That ${provider === 'apple' ? 'Apple' : 'Google'} account already signs in to a different Cloud account.`,
			);
		}
		await ctx.db.patch('users', link.userId, provider === 'apple' ? { apple: true } : { google: true });
	}
	return result;
}

export const startLinkingApple = mutation({
	args: { redirectTo: v.string() },
	handler: (ctx, args): Promise<StartOauth['_returnType']> =>
		startLinking(ctx, api.auth.startSignInWithApple, args.redirectTo),
});

export const completeLinkingApple = mutation({
	args: { code: v.string(), state: v.string() },
	handler: (ctx, args): Promise<CompleteOauth['_returnType']> =>
		finishLinking(ctx, api.auth.completeSignInWithApple, 'apple', args),
});

export const startLinkingGoogle = mutation({
	args: { redirectTo: v.string() },
	handler: (ctx, args): Promise<StartOauth['_returnType']> =>
		startLinking(ctx, api.auth.startSignInWithGoogle, args.redirectTo),
});

export const completeLinkingGoogle = mutation({
	args: { code: v.string(), state: v.string() },
	handler: (ctx, args): Promise<CompleteOauth['_returnType']> =>
		finishLinking(ctx, api.auth.completeSignInWithGoogle, 'google', args),
});

export const { startSignInWithApple, completeSignInWithApple } = setupApple(auth, {
	component: components.authApple,
	allowedRedirectOrigins: [studioUrl.origin],
}).attachUserCallbacks({ createUser: internal.users.createWithApple });

export const { startSignInWithGoogle, completeSignInWithGoogle } = setupGoogle(auth, {
	component: components.authGoogle,
	allowedRedirectOrigins: [studioUrl.origin],
}).attachUserCallbacks({ createUser: internal.users.createWithGoogle });
