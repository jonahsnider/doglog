import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { useSelector } from '@tanstack/react-store';
import { useConvex, useQuery } from 'convex/react';
import { api } from '../../../cloud/convex/_generated/api.js';
import type { Id } from '../../../cloud/convex/_generated/dataModel';
import { ApprovePairing, PairThisDevice } from './device-pairing';
import { accountKeyAttemptStore, accountKeyStore } from './session';

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
