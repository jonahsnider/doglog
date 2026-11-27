import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useSignInWithApple } from '@convex-dev/auth/methods/apple/react';
import { useSignInWithGoogle } from '@convex-dev/auth/methods/google/react';
import { useOauth } from '@convex-dev/auth/methods/oauth/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { AppleLight, Google } from '@ridemountainpig/svgl-react';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import { useConvex } from 'convex/react';
import { ConvexError } from 'convex/values';
import { type SubmitEvent, useState } from 'react';
import { browserSignInStore, cancelBrowserSignIn } from '@/cloud/desktop-sign-in';
import { ceremonies, oauthErrorMessage, runOauthSignIn } from '@/cloud/sign-in-flows';
import { api } from '../../../cloud/convex/_generated/api.js';

const styles = stylex.create({
	// Apple's logo follows the text color
	apple: { fill: 'currentColor' },
});

/** The longest display name the server accepts */
export const displayNameMaxLength = 80;

export function CloudSignIn() {
	const waiting = useSelector(browserSignInStore);
	return (
		<VStack gap={4}>
			<PasskeySignIn />
			<Divider label="or" />
			<OAuthSignIn />
			{waiting && (
				<HStack vAlign="center" wrap="wrap" gap={3}>
					<Text role="status" color="secondary">
						Finish signing in in your browser.
					</Text>
					<Button label="Cancel" size="sm" onClick={cancelBrowserSignIn} />
				</HStack>
			)}
		</VStack>
	);
}

function PasskeySignIn() {
	const convex = useConvex();
	const { setSession } = useAuthActions();
	const [creating, setCreating] = useState(false);
	const [signUpName, setSignUpName] = useState('');
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string>();

	if (!ceremonies.isSupported()) {
		return <Text color="secondary">To sign in with a passkey, open Studio over HTTPS in an up-to-date browser.</Text>;
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
		void run(signUpName);
	}

	function showSignUp(show: boolean) {
		setError(undefined);
		setCreating(show);
	}

	return (
		<VStack gap={3}>
			{creating ? (
				<form onSubmit={submit}>
					<FormLayout>
						<TextInput
							label="Display name"
							description="Your teammates will see this name."
							value={signUpName}
							onChange={(value) => setSignUpName(value.slice(0, displayNameMaxLength))}
							autoComplete="nickname"
							isDisabled={pending}
							isRequired
						/>
						<VStack gap={2}>
							<Button
								type="submit"
								label="Create account with a passkey"
								variant="primary"
								size="lg"
								width="100%"
								isLoading={pending}
							/>
							<Button label="Back" size="lg" width="100%" isDisabled={pending} onClick={() => showSignUp(false)} />
						</VStack>
					</FormLayout>
				</form>
			) : (
				<VStack gap={2}>
					<Button
						label="Sign in with a passkey"
						variant="primary"
						size="lg"
						width="100%"
						isLoading={pending}
						onClick={() => void run()}
					/>
					<Button
						label="Create an account"
						size="lg"
						width="100%"
						isDisabled={pending}
						onClick={() => showSignUp(true)}
					/>
				</VStack>
			)}
			{error !== undefined && <Banner status="error" role="alert" title={error} />}
		</VStack>
	);
}

function OAuthSignIn() {
	const { signIn: signInWithApple } = useSignInWithApple(api.auth);
	const { signIn: signInWithGoogle } = useSignInWithGoogle(api.auth);
	const { flowError } = useOauth();
	const [pending, setPending] = useState<'Apple' | 'Google'>();
	const [error, setError] = useState<string>();

	async function start(provider: 'Apple' | 'Google') {
		setError(undefined);
		setPending(provider);
		const outcome = await runOauthSignIn(provider === 'Apple' ? signInWithApple : signInWithGoogle, provider);
		// The browser leaves this page before coming back with the result.
		setPending(outcome === 'leaving' ? provider : undefined);
		setError(outcome === 'leaving' ? undefined : outcome);
	}

	const shown = error ?? (flowError === null ? undefined : oauthErrorMessage(flowError));
	return (
		<VStack gap={2}>
			<Button
				label="Continue with Apple"
				icon={<AppleLight aria-hidden="true" {...stylex.props(styles.apple)} />}
				size="lg"
				width="100%"
				isLoading={pending === 'Apple'}
				isDisabled={pending === 'Google'}
				onClick={() => void start('Apple')}
			/>
			<Button
				label="Continue with Google"
				icon={<Google aria-hidden="true" />}
				size="lg"
				width="100%"
				isLoading={pending === 'Google'}
				isDisabled={pending === 'Apple'}
				onClick={() => void start('Google')}
			/>
			{shown !== undefined && <Banner status="error" role="alert" title={shown} />}
		</VStack>
	);
}
