import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Layout';
import { ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { useSelector } from '@tanstack/react-store';
import { useAction, useConvex, useQuery } from 'convex/react';
import KeyRoundIcon from 'lucide-react/icons/key-round';
import { SettingsGroup } from '@/components/settings-group';
import { api } from '../../../cloud/convex/_generated/api.js';
import type { Id } from '../../../cloud/convex/_generated/dataModel';
import { resetAccountKey } from './account-key';
import { ConfirmCloudAction } from './confirm-cloud-action';
import { ApprovePairing, PairThisDevice } from './device-pairing';
import { accountKeyAttemptStore, accountKeyStore } from './session';
import { reuploadAll } from './sync-state';

function retryAccountKey() {
	accountKeyAttemptStore.set((attempt) => attempt + 1);
}

export function AccountEncryption({ userId }: { userId: Id<'users'> }) {
	const { url } = useConvex();
	const registeredKey = useQuery(api.users.getMyEncryptionKey);
	const { status } = useSelector(accountKeyStore);
	const account = registeredKey ? { deployment: url, userId, publicKey: registeredKey.publicKey } : undefined;

	return (
		<VStack gap={2} hAlign="start">
			<Text role="status" type="supporting" color="secondary">
				{status === 'loading' && 'Checking your encryption key…'}
				{status === 'ready' && 'When you sign in on another device, approve it here.'}
				{status === 'missing' && 'Approve this sign-in from a device you’re already signed in on.'}
			</Text>
			{account && status === 'missing' && <PairThisDevice account={account} onPaired={retryAccountKey} />}
			{account && status === 'ready' && <ApprovePairing account={account} />}
			{status === 'error' && (
				<Banner
					status="error"
					role="alert"
					title="Couldn’t set up your encryption key."
					endContent={<Button label="Try again" size="sm" onClick={retryAccountKey} />}
				/>
			)}
		</VStack>
	);
}

/** For when no signed-in device can approve this one, ex. they were all lost */
export function ResetAccountKey() {
	const { url } = useConvex();
	const { status } = useSelector(accountKeyStore);
	const account = useQuery(api.users.getCurrent);
	const team = useQuery(api.teams.getMine);
	const reset = useAction(api.users.resetEncryptionKey);
	if (status !== 'missing' || !account || team === undefined) {
		return null;
	}
	const userId = account.id;
	// Only a team's only member can delete it
	const onlyMember = team?.canDelete === true;
	let consequence = '';
	if (onlyMember) {
		consequence =
			'Nobody else can unlock your team’s Cloud dashboards, so they’ll be deleted. Copies saved on this device are uploaded again. ';
	} else if (team) {
		consequence = 'You’ll get access to your team’s Cloud dashboards again when a teammate next opens DogLog Studio. ';
	}

	return (
		<SettingsGroup>
			<ListItem
				startContent={<KeyRoundIcon aria-hidden="true" size={20} />}
				label="Reset encryption key"
				description="If you can’t approve this sign-in from another device."
				endContent={
					<ConfirmCloudAction
						label="Reset key"
						title="Reset your encryption key?"
						description={`${consequence}Devices you’re already signed in on will need to be approved again.`}
						failureMessage="Couldn’t reset your encryption key. Try again."
						destructive={onlyMember}
						onConfirm={async () => {
							// Done first, so the new team key's first sync can't send changes to dashboards Cloud deleted
							if (onlyMember) {
								reuploadAll();
							}
							await resetAccountKey(url, userId, (publicKey) => reset({ userId, publicKey }));
						}}
					/>
				}
			/>
		</SettingsGroup>
	);
}
