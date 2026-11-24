import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { toastManager } from '@/components/toast';
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
		<VStack gap={2}>
			<Text type="label">Your invite link</Text>
			<Text type="supporting" color="secondary">
				Share this link to invite others to collaborate on your team.
			</Text>
			{token === undefined ? (
				<Text role="status" color="secondary">
					Loading your invite link…
				</Text>
			) : link === undefined ? (
				<VStack gap={2} hAlign="start">
					<Button label="Create invite link" isLoading={creating} onClick={() => void create()} />
					{createFailed && <Banner status="error" role="alert" title="Couldn’t create an invite link. Try again." />}
				</VStack>
			) : (
				<HStack vAlign="center" wrap="wrap" gap={2}>
					<StackItem size="fill">
						<TextInput label="Invite link" isLabelHidden isReadOnly value={link} />
					</StackItem>
					<Button label="Copy link" onClick={() => void copyLink(link)} />
					<ConfirmCloudAction
						label="Revoke"
						triggerLabel="Revoke invite link"
						title="Revoke your invite link?"
						description="No one can join with this link anymore, including people waiting for a teammate to add them. You can create a new link afterward."
						failureMessage="Couldn’t revoke the invite link. Try again."
						destructive
						onConfirm={revoke}
					/>
				</HStack>
			)}
		</VStack>
	);
}
