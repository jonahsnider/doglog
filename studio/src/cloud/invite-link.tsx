import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FramePanel } from '@/components/ui/frame';
import { Input } from '@/components/ui/input';
import { toastManager } from '@/components/ui/toast';
import { api } from '../../../cloud/convex/_generated/api.js';
import { ConfirmCloudAction } from './confirm-cloud-action';
import { studioWebsiteOrigin } from './deployment';

async function copyLink(link: string) {
	try {
		await navigator.clipboard.writeText(link);
		toastManager.add({ type: 'success', title: 'Copied the invite link' });
	} catch {
		toastManager.add({ type: 'error', title: 'Couldn’t copy the invite link' });
	}
}

export function InviteLink() {
	const token = useQuery(api.invites.getMine);
	const issue = useMutation(api.invites.issue);
	const revoke = useMutation(api.invites.revoke);
	const [creating, setCreating] = useState(false);
	const [createFailed, setCreateFailed] = useState(false);

	async function create() {
		setCreateFailed(false);
		setCreating(true);
		try {
			await issue();
		} catch {
			setCreateFailed(true);
		}
		setCreating(false);
	}

	let link: string | undefined;
	if (typeof token === 'string') {
		const url = new URL('/cloud', STUDIO_DESKTOP ? studioWebsiteOrigin : location.origin);
		url.searchParams.set('invite', token);
		link = url.href;
	}

	return (
		<FramePanel className="grid gap-2">
			<h2 className="font-heading font-medium text-base">Your invite link</h2>
			<p className="text-muted-foreground text-sm">
				Anyone with this link who isn’t on a team can join. It stops working if you revoke it or stop being an admin.
			</p>
			{token === undefined ? (
				<p role="status" className="text-muted-foreground text-sm">
					Loading your invite link…
				</p>
			) : link === undefined ? (
				<div className="grid justify-items-start gap-2">
					<Button variant="outline" loading={creating} onClick={() => void create()}>
						Create invite link
					</Button>
					{createFailed && (
						<p role="alert" className="text-destructive-foreground text-sm">
							Couldn’t create an invite link. Try again.
						</p>
					)}
				</div>
			) : (
				<div className="flex flex-wrap items-center gap-2">
					<Input readOnly value={link} aria-label="Invite link" className="min-w-0 flex-1 basis-64" />
					<Button variant="outline" onClick={() => void copyLink(link)}>
						Copy link
					</Button>
					<ConfirmCloudAction
						label="Revoke"
						triggerLabel="Revoke invite link"
						title="Revoke your invite link?"
						description="No one can join with this link anymore, including people waiting for a teammate to add them. You can create a new link afterward."
						failureMessage="Couldn’t revoke the invite link. Try again."
						destructive
						onConfirm={revoke}
					/>
				</div>
			)}
		</FramePanel>
	);
}
