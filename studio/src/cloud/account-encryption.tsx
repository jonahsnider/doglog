import { useSelector } from '@tanstack/react-store';
import { useConvex, useQuery } from 'convex/react';
import { Button } from '@/components/ui/button';
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
		<div className="grid gap-2">
			<p role="status" className="text-muted-foreground text-sm">
				{status === 'loading' && 'Checking your encryption key…'}
				{status === 'ready' && 'Encryption key available in this browser.'}
				{status === 'missing' && 'Your account’s encryption key is not available in this browser.'}
			</p>
			{account && status === 'missing' && <PairThisDevice account={account} onPaired={retryAccountKey} />}
			{account && status === 'ready' && <ApprovePairing account={account} />}
			{status === 'error' && (
				<div className="flex flex-wrap items-center gap-2">
					<p role="alert" className="text-destructive-foreground text-sm">
						Couldn’t set up your encryption key.
					</p>
					<Button variant="outline" size="sm" onClick={retryAccountKey}>
						Try again
					</Button>
				</div>
			)}
		</div>
	);
}
