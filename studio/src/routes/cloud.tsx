import { useAuthActions } from '@convex-dev/auth/react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { type SubmitEvent, useState } from 'react';
import { AccountEncryption } from '@/cloud/account-encryption';
import { ConfirmCloudAction } from '@/cloud/confirm-cloud-action';
import { cloudDeploymentUrl } from '@/cloud/deployment';
import { InviteLink } from '@/cloud/invite-link';
import { JoinTeam } from '@/cloud/join-team';
import { CloudSignIn } from '@/cloud/sign-in';
import { TeamMembers } from '@/cloud/team-members';
import { TeamPanel } from '@/cloud/team-panel';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Frame, FramePanel } from '@/components/ui/frame';
import { Input } from '@/components/ui/input';
import { UtilityPage, UtilityPageSection } from '@/components/utility-page';
import { api } from '../../../cloud/convex/_generated/api.js';

export const Route = createFileRoute('/cloud')({
	validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
		invite: typeof search['invite'] === 'string' ? search['invite'] : undefined,
	}),
	beforeLoad: () => (cloudDeploymentUrl === undefined ? redirect({ to: '/', replace: true }) : undefined),
	component: CloudPage,
});

function CloudPage() {
	return <UtilityPage title="Cloud">{cloudDeploymentUrl !== undefined && <CloudAccount />}</UtilityPage>;
}

function CloudAccount() {
	const { isLoading, isAuthenticated } = useConvexAuth();
	if (!isLoading && isAuthenticated) {
		return <SignedIn />;
	}
	return (
		<Frame className="max-w-2xl">
			{isLoading ? (
				<FramePanel>
					<p role="status" className="text-muted-foreground text-sm">
						Checking Cloud sign-in…
					</p>
				</FramePanel>
			) : (
				<CloudSignIn />
			)}
		</Frame>
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
		<div className="flex max-w-2xl flex-col gap-6">
			<UtilityPageSection title="Team">
				{team === null && <JoinTeam invite={invite} />}
				<TeamPanel team={team} invite={invite} />
				{team && <TeamMembers />}
			</UtilityPageSection>

			<UtilityPageSection title="Collaboration">
				{account && <DisplayName key={account.id} name={account.displayName} />}
				{team?.role === 'admin' && <InviteLink />}
			</UtilityPageSection>

			<UtilityPageSection title="Account">
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
			</UtilityPageSection>
		</div>
	);
}

function DisplayName({ name }: { name: string | null }) {
	const setDisplayName = useMutation(api.users.setDisplayName);
	const [draft, setDraft] = useState<string>();
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string>();

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (saving || draft === undefined) {
			return;
		}
		setError(undefined);
		setSaving(true);
		try {
			await setDisplayName({ displayName: draft });
			setDraft(undefined);
			setSaved(true);
		} catch (cause) {
			setError(
				cause instanceof ConvexError && typeof cause.data === 'string'
					? cause.data
					: 'Couldn’t save your display name. Try again.',
			);
		}
		setSaving(false);
	}

	return (
		<FramePanel>
			<form className="grid gap-3" onSubmit={(event) => void save(event)}>
				<Field name="displayName" invalid={error !== undefined}>
					<FieldLabel>Display name</FieldLabel>
					<Input
						name="displayName"
						autoComplete="nickname"
						maxLength={80}
						value={draft ?? name ?? ''}
						onChange={(event) => {
							setDraft(event.currentTarget.value);
							setSaved(false);
						}}
						disabled={saving}
						required
					/>
					<FieldDescription>Your teammates will see this name.</FieldDescription>
					<FieldError match role="alert">
						{error}
					</FieldError>
				</Field>
				<div className="flex flex-wrap items-center gap-3">
					<Button
						type="submit"
						variant="outline"
						loading={saving}
						disabled={draft === undefined || draft.trim() === name}
					>
						Save display name
					</Button>
					{saved && (
						<p role="status" className="text-muted-foreground text-sm">
							Display name saved.
						</p>
					)}
				</div>
			</form>
		</FramePanel>
	);
}
