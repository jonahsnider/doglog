// Sign-in steps shared by signing in and adding sign-in methods
import type { OauthFlowError, UseOauthSignInReturn } from '@convex-dev/auth/methods/oauth/react';
import { ConvexError } from 'convex/values';
import { desktopCeremonies, signInWithOauthInBrowser } from '@/cloud/desktop-sign-in';
import { browserCeremonies } from '@/cloud/passkey-ceremonies';

// The desktop app signs in through Studio's website, since that's where Cloud's passkeys work
export const ceremonies = STUDIO_DESKTOP ? desktopCeremonies : browserCeremonies;

const flowErrors = {
	ACCESS_DENIED: 'Sign-in was canceled.',
	EXPIRED: 'Sign-in took too long. Try again.',
	INVALID_FLOW: 'Couldn’t finish signing in. Start again from this page.',
	OTHER_ERROR: 'Couldn’t finish signing in. Try again.',
};

export function oauthErrorMessage(flowError: OauthFlowError) {
	return flowError.error === 'OTHER_ERROR' &&
		flowError.cause instanceof ConvexError &&
		typeof flowError.cause.data === 'string'
		? flowError.cause.data
		: flowErrors[flowError.error];
}

/**
 * Runs an Apple or Google sign-in. Resolves with `leaving` when the browser leaves this page for the provider, why it
 * failed, or `undefined` once the desktop app finished it or it was canceled.
 */
export async function runOauthSignIn(
	signIn: UseOauthSignInReturn['signIn'],
	provider: 'Apple' | 'Google',
): Promise<string | undefined> {
	const outcome = STUDIO_DESKTOP
		? await signInWithOauthInBrowser(signIn)
		: await signIn().then(
				(result) => (result.status === 'redirect' ? 'leaving' : 'unavailable'),
				() => 'unavailable' as const,
			);
	if (outcome === 'leaving' || outcome === undefined) {
		return outcome;
	}
	return outcome === 'unavailable'
		? `Couldn’t start signing in with ${provider}. Try again.`
		: oauthErrorMessage(outcome);
}
