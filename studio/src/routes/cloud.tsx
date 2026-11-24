import { createUsernamePasskeyHooks } from '@convex-dev/auth/methods/username-passkey/react-custom';
import { useAuthActions } from '@convex-dev/auth/react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { type SubmitEvent, useState } from 'react';
import { AccountEncryption } from '@/cloud/account-encryption';
import { ConfirmCloudAction } from '@/cloud/confirm-cloud-action';
import { cloudDeploymentUrl } from '@/cloud/deployment';
import { InviteLink } from '@/cloud/invite-link';
import { JoinTeam } from '@/cloud/join-team';
import { TeamMembers } from '@/cloud/team-members';
import { TeamPanel } from '@/cloud/team-panel';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Frame, FramePanel } from '@/components/ui/frame';
import { Input } from '@/components/ui/input';
import { UtilityPage } from '@/components/utility-page';
import { api } from '../../../cloud/convex/_generated/api.js';

export const Route = createFileRoute('/cloud')({
	validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
		invite: typeof search['invite'] === 'string' ? search['invite'] : undefined,
	}),
	beforeLoad: () => (cloudDeploymentUrl === undefined ? redirect({ to: '/', replace: true }) : undefined),
	component: CloudPage,
});

function supportsPasskeys(): boolean {
	return (
		globalThis.isSecureContext &&
		typeof PublicKeyCredential !== 'undefined' &&
		typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function' &&
		typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function' &&
		typeof PublicKeyCredential.prototype.toJSON === 'function'
	);
}

const { useSignInWithUsernamePasskey } = createUsernamePasskeyHooks({
	isSupported: supportsPasskeys,
	async register(options) {
		const credential = await navigator.credentials.create({
			publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
		});
		const json = credential instanceof PublicKeyCredential ? credential.toJSON() : undefined;
		if (json === undefined || !('attestationObject' in json.response)) {
			return { success: false, userError: { error: 'CEREMONY_ABORTED' } };
		}
		const { id, rawId, response } = json;
		return { success: true, response: { id, rawId, response, type: 'public-key' } };
	},
	async authenticate(options) {
		const credential = await navigator.credentials.get({
			publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
		});
		const json = credential instanceof PublicKeyCredential ? credential.toJSON() : undefined;
		if (json === undefined || !('signature' in json.response)) {
			return { success: false, userError: { error: 'CEREMONY_ABORTED' } };
		}
		const { id, rawId, response } = json;
		return { success: true, response: { id, rawId, response, type: 'public-key' } };
	},
});

function CloudPage() {
	return (
		<UtilityPage title="Cloud">
			{cloudDeploymentUrl !== undefined && (
				<Frame className="max-w-2xl">
					<CloudAccount />
				</Frame>
			)}
		</UtilityPage>
	);
}

function CloudAccount() {
	const { isLoading, isAuthenticated } = useConvexAuth();
	if (isLoading) {
		return (
			<FramePanel>
				<p role="status" className="text-muted-foreground text-sm">
					Checking Cloud sign-in…
				</p>
			</FramePanel>
		);
	}
	return isAuthenticated ? <SignedIn /> : <PasskeySignIn />;
}

function PasskeySignIn() {
	const { signIn, pending } = useSignInWithUsernamePasskey(api.auth);
	const [error, setError] = useState<string>();
	const supported = supportsPasskeys();

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
		<FramePanel>
			{supported ? (
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
			) : (
				<p className="text-muted-foreground text-sm">
					To sign in with a passkey, open Studio over HTTPS in an up-to-date browser.
				</p>
			)}
		</FramePanel>
	);
}

function SignedIn() {
	const { signOut } = useAuthActions();
	const account = useQuery(api.users.getCurrent);
	const team = useQuery(api.teams.getMine);
	const deleteAccount = useMutation(api.users.remove);
	const { invite } = Route.useSearch();
	const [signingOut, setSigningOut] = useState(false);
	const [signOutError, setSignOutError] = useState(false);

	async function endSession() {
		setSignOutError(false);
		setSigningOut(true);
		try {
			await signOut();
		} catch {
			setSignOutError(true);
		}
		setSigningOut(false);
	}

	return (
		<>
			<FramePanel className="flex flex-wrap items-center justify-between gap-3">
				<div className="grid gap-1">
					<p className="text-sm">Signed in to DogLog Cloud</p>
					{account && <AccountEncryption userId={account.id} />}
					{team !== undefined && team !== null && (
						<p className="text-muted-foreground text-sm">
							{team.canDelete
								? 'Delete your team first if you want to delete your account.'
								: 'You can only delete your account when you’re not on a team.'}
						</p>
					)}
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" loading={signingOut} onClick={() => void endSession()}>
						Sign out
					</Button>
					{team === null && (
						<ConfirmCloudAction
							label="Delete account"
							title="Delete your Cloud account?"
							description="This permanently deletes your Cloud account and signs you out on all devices. Local dashboards aren’t affected."
							failureMessage="Couldn’t delete your Cloud account. Try again."
							destructive
							onConfirm={deleteAccount}
						/>
					)}
				</div>
				{signOutError && (
					<p role="alert" className="w-full text-destructive-foreground text-sm">
						Couldn’t sign out. Try again.
					</p>
				)}
			</FramePanel>
			{team === null && <JoinTeam invite={invite} />}
			<TeamPanel team={team} invite={invite} />
			{team?.role === 'admin' && <InviteLink />}
			{team && <TeamMembers />}
		</>
	);
}
