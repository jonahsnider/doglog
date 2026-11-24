// The desktop app's side of signing in through Studio's website, see sign-in-handoff.ts
import type { OauthFlowError, useSignInWithApple } from '@convex-dev/auth/methods/apple/react';
import type { PasskeyCeremonies } from '@convex-dev/auth/methods/username-passkey/react-custom';
import { createAtom } from '@tanstack/store';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import * as z from 'zod';
import { studioWebsiteOrigin } from './deployment';
import { authenticationResponse, registrationResponse } from './passkey-ceremonies';
import { createHandoffKey, openSignInResult } from './sign-in-handoff';

/** Whether a sign-in is waiting on the browser */
export const browserSignInStore = createAtom(false);

let cancelPending: (() => void) | undefined;

export function cancelBrowserSignIn() {
	cancelPending?.();
}

/**
 * Runs `start` with the key the browser encrypts its result to, and resolves with the result once its `doglog://sign-in`
 * link arrives, or `undefined` if the sign-in is canceled. Starting another sign-in cancels this one.
 */
async function signInInBrowser(start: (key: string) => Promise<unknown>): Promise<unknown> {
	cancelBrowserSignIn();
	const { privateKey, publicKey, encoded } = await createHandoffKey();
	let settle: ((value: unknown) => void) | undefined;
	const result = new Promise<unknown>((resolve) => {
		settle = resolve;
	});
	// Every window gets the link, only the one that started the sign-in can open it
	const unlisten = await listen<string>('sign-in-link', ({ payload }) => {
		openSignInResult(payload, privateKey, publicKey).then(settle, () => undefined);
	});
	const cancel = () => settle?.(undefined);
	cancelPending = cancel;
	browserSignInStore.set(true);
	try {
		await start(encoded);
		return await result;
	} finally {
		unlisten();
		if (cancelPending === cancel) {
			cancelPending = undefined;
			browserSignInStore.set(false);
		}
	}
}

function signInPage(key: string) {
	const url = new URL('/desktop-sign-in', studioWebsiteOrigin);
	url.searchParams.set('key', key);
	return url;
}

/** The request for a passkey ceremony, in the sign-in page's hash */
function passkeyRequestHash(request: object) {
	return new URLSearchParams({ passkey: JSON.stringify(request) }).toString();
}

const canceled = { success: false, userError: { error: 'CEREMONY_ABORTED' } } as const;

/** Runs passkey ceremonies in the browser, for passkeys made on Studio's website */
export const desktopCeremonies = {
	isSupported: () => true,
	async register(options) {
		const result = await signInInBrowser((key) => {
			const url = signInPage(key);
			url.hash = passkeyRequestHash({ ceremony: 'register', options });
			return openUrl(url.href);
		});
		const parsed = z.object({ response: registrationResponse }).safeParse(result);
		return parsed.success ? { success: true, response: parsed.data.response } : canceled;
	},
	async authenticate(options) {
		const result = await signInInBrowser((key) => {
			const url = signInPage(key);
			url.hash = passkeyRequestHash({ ceremony: 'authenticate', options });
			return openUrl(url.href);
		});
		const parsed = z.object({ response: authenticationResponse }).safeParse(result);
		return parsed.success ? { success: true, response: parsed.data.response } : canceled;
	},
} satisfies PasskeyCeremonies;

const appleResult = z.union([z.object({ code: z.string() }), z.object({ error: z.string() })]);

/**
 * Signs in with Apple in the browser. Convex Auth saves the flow here and navigates to Apple, which the app opens in
 * the browser instead. Apple returns to the sign-in page, which sends the code back here to finish signing in.
 * Resolves with why it failed, `unavailable` if it couldn't start, or `undefined` once signed in or canceled.
 */
export async function signInWithAppleInBrowser(
	signIn: ReturnType<typeof useSignInWithApple>['signIn'],
): Promise<OauthFlowError | 'unavailable' | undefined> {
	try {
		const result = await signInInBrowser(async (key) => {
			const started = await signIn({ redirectTo: signInPage(key).href });
			if (started.status === 'error') {
				throw started.userError.cause;
			}
		});
		const parsed = appleResult.safeParse(result);
		if (!parsed.success) {
			return undefined;
		}
		if ('error' in parsed.data) {
			return parsed.data.error === 'access_denied'
				? { error: 'ACCESS_DENIED' }
				: parsed.data.error === 'expired'
					? { error: 'EXPIRED' }
					: { error: 'OTHER_ERROR', cause: parsed.data.error };
		}
		const completed = await signIn({ code: parsed.data.code });
		return completed.status === 'error' ? completed.userError : undefined;
	} catch {
		return 'unavailable';
	}
}
