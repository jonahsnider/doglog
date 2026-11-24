import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import * as z from 'zod';
import { cloudAccountStore } from '@/cloud/session';
import { toastManager } from '@/components/ui/toast';
import { createPersistedAtom } from '@/lib/persisted-store';
import { settingsStore } from '@/settings';
import { displayNameStore } from '@/sharing/identity';

const promptedStore = createPersistedAtom('name-prompted', z.boolean(), false);

/** On the first shared dashboard, suggest setting a local name if the user is signed out and hasn't set one */
export function useNamePrompt(shared: boolean): void {
	const router = useRouter();
	useEffect(() => {
		if (!shared || cloudAccountStore.get() !== null || promptedStore.get() || settingsStore.get().name.trim() !== '') {
			return;
		}

		promptedStore.set(true);
		toastManager.add({
			title: `Others see you as ${displayNameStore.get()}`,
			description: 'Set your name so others in shared dashboards know who you are.',
			actionProps: { children: 'Set name', onClick: () => void router.navigate({ to: '/settings' }) },
		});
	}, [router, shared]);
}
