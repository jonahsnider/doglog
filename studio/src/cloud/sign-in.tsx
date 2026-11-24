import { useSignInWithApple, useOauth } from '@convex-dev/auth/methods/apple/react';
import { createUsernamePasskeyHooks } from '@convex-dev/auth/methods/username-passkey/react-custom';
import { AppleLight } from '@ridemountainpig/svgl-react';
import { type SubmitEvent, useState } from 'react';
import { browserCeremonies, supportsPasskeys } from '@/cloud/passkey-ceremonies';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { FramePanel } from '@/components/ui/frame';
import { Input } from '@/components/ui/input';
import { OrDivider } from '@/widgets/video/options';
import { api } from '../../../cloud/convex/_generated/api.js';

const { useSignInWithUsernamePasskey } = createUsernamePasskeyHooks(browserCeremonies);

export function CloudSignIn() {
	return (
		<FramePanel className="grid gap-4">
			<PasskeySignIn />
			<OrDivider />
			<AppleSignIn />
		</FramePanel>
	);
}

function PasskeySignIn() {
	const { signIn, pending } = useSignInWithUsernamePasskey(api.auth);
	const [error, setError] = useState<string>();

	if (!supportsPasskeys()) {
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
	OTHER_ERROR: 'Couldn’t sign in with Apple. Try again.',
};

function AppleSignIn() {
	const { signIn } = useSignInWithApple(api.auth);
	const { flowError } = useOauth();
	const [pending, setPending] = useState(false);
	const [startError, setStartError] = useState(false);

	async function start() {
		setStartError(false);
		setPending(true);
		const leaving = await signIn().then(
			(result) => result.status === 'redirect',
			() => false,
		);
		// Stays loading while the page leaves for Apple's sign-in, which returns here when it's done
		setPending(leaving);
		setStartError(!leaving);
	}

	const error = startError
		? 'Couldn’t start signing in with Apple. Try again.'
		: flowError === null
			? undefined
			: flowErrors[flowError.error];
	return (
		<div className="grid gap-2">
			<Button variant="outline" className="justify-self-start" loading={pending} onClick={() => void start()}>
				<AppleLight aria-hidden="true" className="fill-current in-data-loading:invisible" />
				Continue with Apple
			</Button>
			{error !== undefined && (
				<p role="alert" className="text-destructive-foreground text-sm">
					{error}
				</p>
			)}
		</div>
	);
}
