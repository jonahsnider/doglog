import { useSignInWithApple } from '@convex-dev/auth/methods/apple/react';
import { useSignInWithGoogle } from '@convex-dev/auth/methods/google/react';
import { useOauth } from '@convex-dev/auth/methods/oauth/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { AppleLight, Google } from '@ridemountainpig/svgl-react';
import { useSelector } from '@tanstack/react-store';
import { useConvex } from 'convex/react';
import { ConvexError } from 'convex/values';
import { type SubmitEvent, useState } from 'react';
import {
	browserSignInStore,
	cancelBrowserSignIn,
	desktopCeremonies,
	signInWithOauthInBrowser,
} from '@/cloud/desktop-sign-in';
import { browserCeremonies } from '@/cloud/passkey-ceremonies';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { FramePanel } from '@/components/ui/frame';
import { Input } from '@/components/ui/input';
import { OrDivider } from '@/widgets/video/options';
import { api } from '../../../cloud/convex/_generated/api.js';

// The desktop app signs in through Studio's website, since that's where Cloud's passkeys work
const ceremonies = STUDIO_DESKTOP ? desktopCeremonies : browserCeremonies;

export function CloudSignIn() {
	const waiting = useSelector(browserSignInStore);
	return (
		<FramePanel className="grid gap-4">
			<PasskeySignIn />
			<OrDivider />
			<OAuthSignIn />
			{waiting && (
				<div className="flex flex-wrap items-center gap-3">
					<p role="status" className="text-muted-foreground text-sm">
						Finish signing in in your browser.
					</p>
					<Button variant="outline" size="sm" onClick={cancelBrowserSignIn}>
						Cancel
					</Button>
				</div>
			)}
		</FramePanel>
	);
}

function PasskeySignIn() {
	const convex = useConvex();
	const { setSession } = useAuthActions();
	const [creating, setCreating] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string>();

	if (!ceremonies.isSupported()) {
		return (
			<p className="text-muted-foreground text-sm">
				To sign in with a passkey, open Studio over HTTPS in an up-to-date browser.
			</p>
		);
	}

	async function run(displayName?: string) {
		if (pending) {
			return;
		}
		setError(undefined);
		setPending(true);
		try {
			const result = await (displayName === undefined ? signIn() : signUp(displayName));
			if (result?.status === 'complete') {
				await setSession(result.tokens);
			} else if (result === undefined) {
				setError('The passkey prompt was closed or timed out. Try again when you’re ready.');
			} else if (result.userError.error === 'UNKNOWN_CREDENTIAL') {
				setError('That passkey isn’t linked to a Cloud account. Try another passkey.');
			} else {
				setError('Couldn’t continue with your passkey. Try again.');
			}
		} catch (cause) {
			if (cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'AbortError')) {
				setError('The passkey prompt was closed or timed out. Try again when you’re ready.');
			} else if (cause instanceof ConvexError && typeof cause.data === 'string') {
				setError(cause.data);
			} else {
				setError('Couldn’t continue with your passkey. Try again.');
			}
		}
		setPending(false);
	}

	async function signIn() {
		const options = await convex.mutation(api.auth.startPasskeySignIn, {});
		const result = await ceremonies.authenticate(options);
		return result.success ? convex.mutation(api.auth.finishPasskeySignIn, { response: result.response }) : undefined;
	}

	async function signUp(displayName: string) {
		const options = await convex.mutation(api.auth.startPasskeySignUp, { displayName });
		const result = await ceremonies.register(options);
		return result.success
			? convex.mutation(api.auth.finishPasskeySignUp, { displayName, response: result.response })
			: undefined;
	}

	function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const value = new FormData(event.currentTarget).get('displayName');
		if (typeof value === 'string') {
			void run(value);
		}
	}

	function showSignUp(show: boolean) {
		setError(undefined);
		setCreating(show);
	}

	return (
		<div className="grid gap-3">
			{creating ? (
				<form className="grid gap-3" onSubmit={submit}>
					<Field name="displayName">
						<FieldLabel>Display name</FieldLabel>
						<Input name="displayName" autoComplete="nickname" maxLength={80} disabled={pending} required />
						<FieldDescription>Your teammates will see this name.</FieldDescription>
					</Field>
					<div className="flex flex-wrap gap-2">
						<Button type="submit" loading={pending}>
							Create account with a passkey
						</Button>
						<Button type="button" variant="outline" disabled={pending} onClick={() => showSignUp(false)}>
							Back
						</Button>
					</div>
				</form>
			) : (
				<div className="flex flex-wrap gap-2">
					<Button loading={pending} onClick={() => void run()}>
						Sign in with a passkey
					</Button>
					<Button variant="outline" disabled={pending} onClick={() => showSignUp(true)}>
						Create an account
					</Button>
				</div>
			)}
			{error !== undefined && (
				<p role="alert" className="text-destructive-foreground text-sm">
					{error}
				</p>
			)}
		</div>
	);
}

const flowErrors = {
	ACCESS_DENIED: 'Sign-in was canceled.',
	EXPIRED: 'Sign-in took too long. Try again.',
	INVALID_FLOW: 'Couldn’t finish signing in. Start again from this page.',
	OTHER_ERROR: 'Couldn’t finish signing in. Try again.',
};

function OAuthSignIn() {
	const { signIn: signInWithApple } = useSignInWithApple(api.auth);
	const { signIn: signInWithGoogle } = useSignInWithGoogle(api.auth);
	const { flowError } = useOauth();
	const [pending, setPending] = useState<'Apple' | 'Google'>();
	const [error, setError] = useState<string>();

	async function start(provider: 'Apple' | 'Google') {
		const signIn = provider === 'Apple' ? signInWithApple : signInWithGoogle;
		setError(undefined);
		setPending(provider);
		const outcome = STUDIO_DESKTOP
			? await signInWithOauthInBrowser(signIn)
			: await signIn().then(
					(result) => (result.status === 'redirect' ? 'leaving' : 'unavailable'),
					() => 'unavailable' as const,
				);
		// The browser leaves this page before coming back with the result.
		setPending(outcome === 'leaving' ? provider : undefined);
		setError(
			outcome === 'leaving' || outcome === undefined
				? undefined
				: outcome === 'unavailable'
					? `Couldn’t start signing in with ${provider}. Try again.`
					: flowErrors[outcome.error],
		);
	}

	const shown = error ?? (flowError === null ? undefined : flowErrors[flowError.error]);
	return (
		<div className="grid gap-2">
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					loading={pending === 'Apple'}
					disabled={pending === 'Google'}
					onClick={() => void start('Apple')}
				>
					<AppleLight aria-hidden="true" className="fill-current in-data-loading:invisible" />
					Continue with Apple
				</Button>
				<Button
					variant="outline"
					loading={pending === 'Google'}
					disabled={pending === 'Apple'}
					onClick={() => void start('Google')}
				>
					<Google aria-hidden="true" className="in-data-loading:invisible" />
					Continue with Google
				</Button>
			</div>
			{shown !== undefined && (
				<p role="alert" className="text-destructive-foreground text-sm">
					{shown}
				</p>
			)}
		</div>
	);
}
