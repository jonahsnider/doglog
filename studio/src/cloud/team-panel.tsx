import { Banner } from '@astryxdesign/core/Banner';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { useSelector } from '@tanstack/react-store';
import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useState } from 'react';
import { AppActionMenu } from '@/components/app-context-menu';
import { api } from '../../../cloud/convex/_generated/api.js';
import { ConfirmCloudDialog } from './confirm-cloud-action';
import { CreateTeam } from './create-team';
import { teamKeyStore } from './session';

export function TeamPanel({
	team,
	invite,
}: {
	team: FunctionReturnType<typeof api.teams.getMine> | undefined;
	invite: string | undefined;
}) {
	const deleteTeam = useMutation(api.teams.remove);
	const leaveTeam = useMutation(api.teams.leave);
	const [confirming, setConfirming] = useState<'leave' | 'delete'>();
	if (team === undefined) {
		return (
			<Text role="status" color="secondary">
				Loading your team…
			</Text>
		);
	}
	if (team === null) {
		return <CreateTeam />;
	}
	return (
		<>
			<HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
				<VStack gap={1}>
					<Heading level={3} wordBreak="break-word">
						{team.name}
					</Heading>
				</VStack>
				<AppActionMenu
					label="Team options"
					items={() => [
						...(team.canLeave ? [{ label: 'Leave team', onSelect: () => setConfirming('leave') }] : []),
						{
							label: 'Delete team',
							disabled: !team.canDelete,
							description: team.canDelete
								? undefined
								: team.role === 'admin'
									? 'You must be the only member to delete the team.'
									: 'Only team admins can delete the team.',
							onSelect: () => setConfirming('delete'),
						},
					]}
				/>
			</HStack>
			{invite !== undefined && (
				<Banner status="info" title="You’re already on a team, so you can’t join another with this invite." />
			)}
			<TeamKeyStatus />
			<ConfirmCloudDialog
				open={confirming === 'leave'}
				onOpenChange={() => setConfirming(undefined)}
				label="Leave team"
				title={`Leave ${team.name}?`}
				description="You’ll lose access to the team’s Cloud dashboards. Your Cloud account and local dashboards aren’t affected. You can rejoin later with an invite link."
				failureMessage="Couldn’t leave the team. Try again."
				destructive
				onConfirm={leaveTeam}
			/>
			<ConfirmCloudDialog
				open={confirming === 'delete'}
				onOpenChange={() => setConfirming(undefined)}
				label="Delete team"
				title={`Delete ${team.name}?`}
				description="This permanently deletes the team and all saved Cloud dashboards. Your Cloud account and local dashboards aren’t affected."
				failureMessage="Couldn’t delete the team. Try again."
				destructive
				onConfirm={() => deleteTeam({ teamId: team.id })}
			/>
		</>
	);
}

function TeamKeyStatus() {
	const state = useSelector(teamKeyStore);
	if (state === 'waiting') {
		return (
			<Banner
				status="info"
				title="You’ll get access to your team’s Cloud dashboards when a teammate next opens DogLog Studio."
			/>
		);
	}
	return state === 'failed' ? (
		<Banner status="error" role="alert" title="Couldn’t unlock your team’s encryption key on this device." />
	) : null;
}
