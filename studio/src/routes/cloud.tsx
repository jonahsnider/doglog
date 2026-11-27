import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Center } from '@astryxdesign/core/Center';
import { Divider } from '@astryxdesign/core/Divider';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { ListItem } from '@astryxdesign/core/List';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Heading, Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useAuthActions } from '@convex-dev/auth/react';
import * as stylex from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import LogOutIcon from 'lucide-react/icons/log-out';
import Trash2Icon from 'lucide-react/icons/trash-2';
import { type SubmitEvent, useState } from 'react';
import { AccountEncryption } from '@/cloud/account-encryption';
import { ConfirmCloudAction } from '@/cloud/confirm-cloud-action';
import { InviteLink } from '@/cloud/invite-link';
import { JoinTeam } from '@/cloud/join-team';
import { CloudSignIn, displayNameMaxLength } from '@/cloud/sign-in';
import { SignInMethods } from '@/cloud/sign-in-methods';
import { TeamDefaults } from '@/cloud/team-defaults';
import { TeamMembers } from '@/cloud/team-members';
import { TeamPanel } from '@/cloud/team-panel';
import { SettingsGroup } from '@/components/settings-group';
import { UtilityPage, UtilityPageSection } from '@/components/utility-page';
import { api } from '../../../cloud/convex/_generated/api.js';

const styles = stylex.create({
	scroll: { height: '100%', overflowY: 'auto' },
});

export const Route = createFileRoute('/cloud')({
	validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
		invite: typeof search['invite'] === 'string' ? search['invite'] : undefined,
	}),
	component: CloudPage,
});

function CloudPage() {
	const { isLoading, isAuthenticated } = useConvexAuth();
	if (isLoading) {
		return (
			<Center height="100%" role="status">
				<Spinner size="lg" label="Checking Cloud sign-in…" />
			</Center>
		);
	}
	if (!isAuthenticated) {
		return (
			<div {...stylex.props(styles.scroll)}>
				<Center minHeight="100%" padding={6}>
					<VStack gap={8} width="100%" maxWidth={360}>
						<VStack gap={3} hAlign="center">
							<img src="/logo.svg" alt="" width={56} height={56} />
							<VStack gap={1} hAlign="center">
								<Heading level={1}>Sign in to DogLog Cloud</Heading>
								<Text color="secondary" justify="center">
									Share dashboards with your team
								</Text>
							</VStack>
						</VStack>
						<CloudSignIn />
					</VStack>
				</Center>
			</div>
		);
	}
	return (
		<UtilityPage title="Cloud">
			<SignedIn />
		</UtilityPage>
	);
}

function SignedIn() {
	const { signOut } = useAuthActions();
	const account = useQuery(api.users.getCurrent);
	const team = useQuery(api.teams.getMine);
	const pendingInvites = useQuery(api.invites.listPending, team === null ? {} : 'skip');
	const deleteAccount = useMutation(api.users.remove);
	const { invite } = Route.useSearch();
	const [signingOut, setSigningOut] = useState(false);
	const [signOutError, setSignOutError] = useState(false);
	let deleteAccountDisabledReason: string | undefined;
	if (team === undefined) {
		deleteAccountDisabledReason = 'Checking your team membership…';
	} else if (team !== null) {
		if (team.canDelete) {
			deleteAccountDisabledReason = 'Delete your team first.';
		} else if (team.canLeave) {
			deleteAccountDisabledReason = 'Leave your team first.';
		} else {
			deleteAccountDisabledReason = 'Make another member an admin, then leave your team.';
		}
	}

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
		<VStack gap={8}>
			<UtilityPageSection title="Team">
				{team === null && <JoinTeam invite={invite} pending={pendingInvites} />}
				{(team !== null || pendingInvites?.length === 0) && <TeamPanel team={team} invite={invite} />}
				{team && <TeamMembers />}
			</UtilityPageSection>

			<Divider />

			<TeamDefaults team={team} />

			<UtilityPageSection title="Collaboration">
				{account && <DisplayName key={account.id} name={account.displayName} />}
				{team?.role === 'admin' && <InviteLink />}
			</UtilityPageSection>

			<Divider />

			<UtilityPageSection title="Account">
				<VStack gap={1}>
					<Text>Signed in to DogLog Cloud</Text>
					{account && <AccountEncryption userId={account.id} />}
				</VStack>
				<SignInMethods />
				<SettingsGroup>
					<ListItem
						startContent={<LogOutIcon aria-hidden="true" size={20} />}
						label="Sign out"
						description="Local dashboards stay on this device."
						endContent={<Button label="Sign out" isLoading={signingOut} onClick={() => void endSession()} />}
					/>
				</SettingsGroup>
				<SettingsGroup>
					<ListItem
						startContent={<Trash2Icon aria-hidden="true" size={20} />}
						label="Delete account"
						description="This can’t be undone."
						endContent={
							<ConfirmCloudAction
								label="Delete account"
								variant="destructive"
								title="Delete your Cloud account?"
								description="This permanently deletes your Cloud account and signs you out on all devices. Local dashboards aren’t affected."
								failureMessage="Couldn’t delete your Cloud account. Try again."
								destructive
								disabledReason={deleteAccountDisabledReason}
								onConfirm={deleteAccount}
							/>
						}
					/>
				</SettingsGroup>
				{signOutError && <Banner status="error" role="alert" title="Couldn’t sign out. Try again." />}
			</UtilityPageSection>
		</VStack>
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
		<form onSubmit={(event) => void save(event)}>
			<FormLayout>
				<TextInput
					label="Display name"
					description="Your teammates will see this name."
					value={draft ?? name ?? ''}
					onChange={(value) => {
						setDraft(value.slice(0, displayNameMaxLength));
						setSaved(false);
					}}
					autoComplete="nickname"
					isDisabled={saving}
					isRequired
					status={error === undefined ? undefined : { type: 'error', message: error }}
				/>
				<HStack vAlign="center" wrap="wrap" gap={3}>
					<Button
						type="submit"
						label="Save display name"
						isLoading={saving}
						isDisabled={draft === undefined || draft.trim() === name}
					/>
					{saved && (
						<Text role="status" color="secondary">
							Display name saved.
						</Text>
					)}
				</HStack>
			</FormLayout>
		</form>
	);
}
