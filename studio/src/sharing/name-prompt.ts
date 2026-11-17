import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import * as z from 'zod';
import { toastManager } from '@/components/ui/toast';
import { createPersistedAtom } from '@/lib/persisted-store';
import { settingsStore } from '@/settings';
import { getDisplayName } from '@/sharing/identity';

const promptedStore = createPersistedAtom('name-prompted', z.boolean(), false);

/** The first time the user opens a shared dashboard without a name, suggest setting one so others know who they are */
export function useNamePrompt(shared: boolean): void {
	const router = useRouter();
	useEffect(() => {
		if (!shared || promptedStore.get() || settingsStore.get().name.trim() !== '') {
			return;
		}

		promptedStore.set(true);
		toastManager.add({
			title: `Others see you as ${getDisplayName()}`,
			description: 'Set your name so others in shared dashboards know who you are.',
			actionProps: { children: 'Set name', onClick: () => void router.navigate({ to: '/settings' }) },
		});
	}, [router, shared]);
}
