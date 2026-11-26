import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { useClipboard } from '@astryxdesign/core/hooks';
import { IconButton } from '@astryxdesign/core/IconButton';
import { InputGroup } from '@astryxdesign/core/InputGroup';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { durationVars, easeVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useMutation, useQuery } from 'convex/react';
import CheckIcon from 'lucide-react/icons/check';
import CopyIcon from 'lucide-react/icons/copy';
import { useState } from 'react';
import { AppActionMenu } from '@/components/app-context-menu';
import { toastManager } from '@/components/toast';
import { api } from '../../../cloud/convex/_generated/api.js';
import { ConfirmCloudDialog } from './confirm-cloud-action';
import { studioWebsiteOrigin } from './deployment';

const styles = stylex.create({
	// Stacks the copy and check icons, so they cross-fade
	icons: { display: 'grid', width: '100%', height: '100%' },
	icon: {
		gridArea: '1 / 1',
		width: '100%',
		height: '100%',
		transitionProperty: 'opacity, scale',
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	hidden: { opacity: 0, scale: 0.5 },
});

export function InviteLink() {
	const token = useQuery(api.invites.getMine);
	const issue = useMutation(api.invites.issue);
	const revoke = useMutation(api.invites.revoke);
	const [creating, setCreating] = useState(false);
	const [createFailed, setCreateFailed] = useState(false);
	const [revoking, setRevoking] = useState(false);
	const { copy, isCopied } = useClipboard({ announce: 'Copied the invite link' });

	async function copyLink(link: string) {
		if (!(await copy(link))) {
			toastManager.add({ type: 'error', title: 'Couldn’t copy the invite link' });
		}
	}

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
						<InputGroup label="Invite link" isLabelHidden>
							<TextInput label="Invite link" isReadOnly value={link} />
							<IconButton
								label="Copy invite link"
								tooltip="Copy"
								icon={
									<span {...stylex.props(styles.icons)}>
										<CopyIcon {...stylex.props(styles.icon, isCopied && styles.hidden)} />
										<CheckIcon {...stylex.props(styles.icon, !isCopied && styles.hidden)} />
									</span>
								}
								onClick={() => void copyLink(link)}
							/>
						</InputGroup>
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
