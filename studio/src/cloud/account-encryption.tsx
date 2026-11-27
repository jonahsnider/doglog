import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Layout';
import { ListItem } from '@astryxdesign/core/List';
import { useSelector } from '@tanstack/react-store';
import { useAction, useConvex, useQuery } from 'convex/react';
import CheckIcon from 'lucide-react/icons/check';
import ClockIcon from 'lucide-react/icons/clock';
import CloudCheckIcon from 'lucide-react/icons/cloud-check';
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

const iconSize = 20;

const keyStatus = {
	loading: {
		description: 'Checking your encryption key…',
		endContent: <Badge label="Checking" />,
	},
	ready: {
		description: 'When you sign in on another device, approve it here.',
		endContent: <Badge icon={<CheckIcon aria-hidden="true" size={12} />} label="Available" />,
	},
	missing: {
		description: 'Approve this sign-in from a device you’re already signed in on.',
		endContent: <Badge variant="warning" icon={<ClockIcon aria-hidden="true" size={12} />} label="Needs approval" />,
	},
	error: {
		description: 'Couldn’t set up your encryption key.',
		endContent: <Button label="Try again" onClick={retryAccountKey} />,
	},
};

/** Shows that this device is signed in and whether it has the account's encryption key, with pairing to get or share it */
export function AccountStatus({ account }: { account: { id: Id<'users'>; displayName: string | null } }) {
	const { url } = useConvex();
	const registeredKey = useQuery(api.users.getMyEncryptionKey);
	const { status } = useSelector(accountKeyStore);
	const pairing = registeredKey
		? { deployment: url, userId: account.id, publicKey: registeredKey.publicKey }
		: undefined;
	const key = keyStatus[status];

	return (
		<SettingsGroup>
			<ListItem
				align="first-line"
				startContent={<CloudCheckIcon aria-hidden="true" size={iconSize} />}
				label="Account"
				description={account.displayName ?? 'DogLog Cloud'}
				endContent={<Badge icon={<CheckIcon aria-hidden="true" size={12} />} label="Signed in" />}
			/>
			<ListItem
				// Keeps the icon and badge by the label while pairing steps grow the row
				align="first-line"
				startContent={<KeyRoundIcon aria-hidden="true" size={iconSize} />}
				label="Encryption key"
				description={
					<VStack gap={3} hAlign="start">
						<span role={status === 'error' ? 'alert' : 'status'}>{key.description}</span>
						{pairing && status === 'missing' && <PairThisDevice account={pairing} onPaired={retryAccountKey} />}
						{pairing && status === 'ready' && <ApprovePairing account={pairing} />}
					</VStack>
				}
				endContent={key.endContent}
			/>
		</SettingsGroup>
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
