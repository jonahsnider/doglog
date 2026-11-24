import { useSignInWithApple } from '@convex-dev/auth/methods/apple/react';
import { useSignInWithGoogle } from '@convex-dev/auth/methods/google/react';
import { useOauth } from '@convex-dev/auth/methods/oauth/react';
import { createUsernamePasskeyHooks } from '@convex-dev/auth/methods/username-passkey/react-custom';
import { AppleLight, Google } from '@ridemountainpig/svgl-react';
import { useSelector } from '@tanstack/react-store';
import { type SubmitEvent, useState } from 'react';
import {
	browserSignInStore,
	cancelBrowserSignIn,
	desktopCeremonies,
	signInWithOauthInBrowser,
} from '@/cloud/desktop-sign-in';
import { browserCeremonies, supportsPasskeys } from '@/cloud/passkey-ceremonies';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { FramePanel } from '@/components/ui/frame';
import { Input } from '@/components/ui/input';
import { OrDivider } from '@/widgets/video/options';
import { api } from '../../../cloud/convex/_generated/api.js';

// The desktop app signs in through Studio's website, since that's where Cloud's passkeys work
const { useSignInWithUsernamePasskey } = createUsernamePasskeyHooks(
	STUDIO_DESKTOP ? desktopCeremonies : browserCeremonies,
);

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
	const { signIn, pending } = useSignInWithUsernamePasskey(api.auth);
	const [error, setError] = useState<string>();

	if (!STUDIO_DESKTOP && !supportsPasskeys()) {
		return (
			<p className="text-muted-foreground text-sm">
				To sign in with a passkey, open Studio over HTTPS in an up-to-date browser.
			</p>
		);
	}

	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending) {
			return;
		}
		const value = new FormData(event.currentTarget).get('username');
		const username = typeof value === 'string' ? value.trim() : '';
		if (username === '') {
			setError('Enter a username.');
			return;
		}
		setError(undefined);
		try {
			const result = await signIn({ username });
			if (result.status !== 'error') {
				return;
			}
			switch (result.userError.error) {
				case 'CEREMONY_ABORTED':
					setError('The passkey prompt was closed or timed out. Try again when you’re ready.');
					break;
				case 'UNKNOWN_CREDENTIAL':
					setError('That passkey doesn’t match this account. Try another passkey.');
					break;
				default:
					setError('Couldn’t continue with your passkey. Try again.');
			}
		} catch {
			setError('Couldn’t reach DogLog Cloud. Check your connection and try again.');
		}
	}

	return (
		<form className="grid gap-3" onSubmit={(event) => void submit(event)}>
			<Field name="username" invalid={error !== undefined}>
				<FieldLabel>Username</FieldLabel>
				<Input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
				<FieldDescription>New to Cloud? Choose a username to create an account.</FieldDescription>
				<FieldError match role="alert">
					{error}
				</FieldError>
			</Field>
			<Button type="submit" className="justify-self-start" loading={pending}>
				Continue with passkey
			</Button>
		</form>
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
