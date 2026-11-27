import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { AppActionMenu } from '@/components/app-context-menu';
import { CopyField } from '@/components/copy-field';
import { api } from '../../../cloud/convex/_generated/api.js';
import { ConfirmCloudDialog } from './confirm-cloud-action';
import { studioWebsiteOrigin } from './deployment';

export function InviteLink() {
	const token = useQuery(api.invites.getMine);
	const issue = useMutation(api.invites.issue);
	const revoke = useMutation(api.invites.revoke);
	const [creating, setCreating] = useState(false);
	const [createFailed, setCreateFailed] = useState(false);
	const [revoking, setRevoking] = useState(false);

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
				<HStack vAlign="center" gap={2}>
					<StackItem size="fill">
						<CopyField label="Invite link" value={link} />
					</StackItem>
					<AppActionMenu
						label="Invite link options"
						items={() => [{ label: 'Revoke', onSelect: () => setRevoking(true) }]}
					/>
					<ConfirmCloudDialog
						open={revoking}
						onOpenChange={setRevoking}
						label="Revoke"
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
