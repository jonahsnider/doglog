import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Layout';
import { ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { useSignInWithApple } from '@convex-dev/auth/methods/apple/react';
import { useSignInWithGoogle } from '@convex-dev/auth/methods/google/react';
import { useOauth } from '@convex-dev/auth/methods/oauth/react';
import { AppleLight, Google } from '@ridemountainpig/svgl-react';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import KeyRoundIcon from 'lucide-react/icons/key-round';
import PlusIcon from 'lucide-react/icons/plus';
import { useState } from 'react';
import { browserSignInStore, cancelBrowserSignIn } from '@/cloud/desktop-sign-in';
import { ceremonies, oauthErrorMessage, runOauthSignIn } from '@/cloud/sign-in-flows';
import { SettingsGroup } from '@/components/settings-group';
import { api } from '../../../cloud/convex/_generated/api.js';
import { ConfirmCloudAction } from './confirm-cloud-action';

const styles = stylex.create({
	// Apple's logo follows the text color
	apple: { fill: 'currentColor' },
});

const iconSize = 20;

type Method = 'passkey' | 'Apple' | 'Google';

/** Lets an account sign in with more than one method, for people who forget which one they used */
export function SignInMethods() {
	const convex = useConvex();
	const methods = useQuery(api.users.getSignInMethods);
	const removePasskey = useMutation(api.users.removePasskey);
	const unlink = useMutation(api.users.unlink);
	// Linking finishes Apple's or Google's sign-in as this account, see `finishLinking`
	const { signIn: linkApple } = useSignInWithApple({
		startSignInWithApple: api.auth.startLinkingApple,
		completeSignInWithApple: api.auth.completeLinkingApple,
	});
	const { signIn: linkGoogle } = useSignInWithGoogle({
		startSignInWithGoogle: api.auth.startLinkingGoogle,
		completeSignInWithGoogle: api.auth.completeLinkingGoogle,
	});
	const { flowError } = useOauth();
	const waiting = useSelector(browserSignInStore);
	const [pending, setPending] = useState<Method>();
	const [error, setError] = useState<string>();

	if (!methods) {
		return null;
	}

	async function addPasskey() {
		setError(undefined);
		setPending('passkey');
		try {
			const options = await convex.mutation(api.auth.startAddingPasskey, {});
			const result = await ceremonies.register(options);
			const userError = result.success
				? await convex.mutation(api.auth.finishAddingPasskey, { response: result.response })
				: result.userError;
			if (userError?.error === 'CEREMONY_ABORTED') {
				setError('The passkey prompt was closed or timed out. Try again when you’re ready.');
			} else if (userError) {
				setError('Couldn’t add your passkey. Try again.');
			}
		} catch (cause) {
			if (cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'AbortError')) {
				setError('The passkey prompt was closed or timed out. Try again when you’re ready.');
			} else if (cause instanceof DOMException && cause.name === 'InvalidStateError') {
				setError('That device already has a passkey for this account.');
			} else if (cause instanceof ConvexError && typeof cause.data === 'string') {
				setError(cause.data);
			} else {
				setError('Couldn’t add your passkey. Try again.');
			}
		}
		setPending(undefined);
	}

	async function link(provider: 'Apple' | 'Google') {
		setError(undefined);
		setPending(provider);
		const outcome = await runOauthSignIn(provider === 'Apple' ? linkApple : linkGoogle, provider);
		// The browser leaves this page before coming back with the result.
		setPending(outcome === 'leaving' ? provider : undefined);
		setError(outcome === 'leaving' ? undefined : outcome);
	}

	const lastMethod =
		methods.passkeys.length + Number(methods.apple) + Number(methods.google) <= 1
			? 'Add another way to sign in first.'
			: undefined;

	function providerAction(provider: 'Apple' | 'Google', linked: boolean) {
		if (linked) {
			return (
				<ConfirmCloudAction
					label="Unlink"
					triggerLabel={`Unlink ${provider}`}
					variant="ghost"
					title={`Unlink ${provider}?`}
					description={`You won’t be able to sign in to this account with ${provider}. You can link it again later.`}
					failureMessage={`Couldn’t unlink ${provider}. Try again.`}
					disabledReason={lastMethod}
					onConfirm={() => unlink({ provider: provider === 'Apple' ? 'apple' : 'google' })}
				/>
			);
		}
		return (
			<Button
				label={`Link ${provider}`}
				isLoading={pending === provider}
				isDisabled={pending !== undefined && pending !== provider}
				onClick={() => void link(provider)}
			/>
		);
	}

	const shown = error ?? (flowError === null ? undefined : oauthErrorMessage(flowError));
	return (
		<>
			<SettingsGroup title="Passkeys">
				{methods.passkeys.map((passkey) => (
					<ListItem
						key={passkey.id}
						startContent={<KeyRoundIcon aria-hidden="true" size={iconSize} />}
						label={passkey.name ?? 'Passkey'}
						description={passkey.name === null ? 'Provider unknown' : undefined}
						endContent={
							<ConfirmCloudAction
								label="Remove"
								triggerLabel={`Remove ${passkey.name ?? 'passkey'}`}
								variant="ghost"
								title={passkey.name === null ? 'Remove this passkey?' : `Remove your ${passkey.name} passkey?`}
								description="You won’t be able to sign in with it anymore. Delete it from your password manager too, so it isn’t offered when you sign in."
								failureMessage="Couldn’t remove the passkey. Try again."
								disabledReason={lastMethod}
								onConfirm={() => removePasskey({ passkeyId: passkey.id })}
							/>
						}
					/>
				))}
				<ListItem
					startContent={<PlusIcon aria-hidden="true" size={iconSize} />}
					label="Add a passkey"
					// A fragment wraps on narrow screens, where a string description is cut off
					description={<>Sign in with your device or password manager</>}
					endContent={
						<Button
							label="Add passkey"
							isLoading={pending === 'passkey'}
							isDisabled={!ceremonies.isSupported() || (pending !== undefined && pending !== 'passkey')}
							tooltip={
								ceremonies.isSupported()
									? undefined
									: 'Open Studio over HTTPS in an up-to-date browser to add a passkey.'
							}
							onClick={() => void addPasskey()}
						/>
					}
				/>
			</SettingsGroup>
			<SettingsGroup title="Linked accounts">
				<ListItem
					startContent={
						<AppleLight aria-hidden="true" width={iconSize} height={iconSize} {...stylex.props(styles.apple)} />
					}
					label="Apple"
					description={methods.apple ? 'Linked' : 'Not linked'}
					endContent={providerAction('Apple', methods.apple)}
				/>
				<ListItem
					startContent={<Google aria-hidden="true" width={iconSize} height={iconSize} />}
					label="Google"
					description={methods.google ? 'Linked' : 'Not linked'}
					endContent={providerAction('Google', methods.google)}
				/>
			</SettingsGroup>
			{waiting && (
				<HStack vAlign="center" wrap="wrap" gap={3}>
					<Text role="status" color="secondary">
						Finish in your browser.
					</Text>
					<Button label="Cancel" size="sm" onClick={cancelBrowserSignIn} />
				</HStack>
			)}
			{shown !== undefined && <Banner status="error" role="alert" title={shown} />}
		</>
	);
}
