import { Banner } from '@astryxdesign/core/Banner';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { useSelector } from '@tanstack/react-store';
import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../cloud/convex/_generated/api.js';
import { ConfirmCloudAction } from './confirm-cloud-action';
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
					<Text type="supporting" color="secondary">
						{team.role === 'admin' ? 'Team admin' : 'Team member'}
					</Text>
				</VStack>
				<HStack wrap="wrap" gap={2}>
					{team.canLeave && (
						<ConfirmCloudAction
							key={`leave-${team.id}`}
							label="Leave team"
							title={`Leave ${team.name}?`}
							description="You’ll lose access to the team’s Cloud dashboards. Your Cloud account and local dashboards aren’t affected. You can rejoin later with an invite link."
							failureMessage="Couldn’t leave the team. Try again."
							destructive
							onConfirm={leaveTeam}
						/>
					)}
					<ConfirmCloudAction
						key={team.id}
						label="Delete team"
						title={`Delete ${team.name}?`}
						description="This permanently deletes the team and all saved Cloud dashboards. Your Cloud account and local dashboards aren’t affected."
						failureMessage="Couldn’t delete the team. Try again."
						destructive
						disabledReason={
							team.canDelete
								? undefined
								: team.role === 'admin'
									? 'You must be the only member to delete the team.'
									: 'Only team admins can delete the team.'
						}
						onConfirm={() => deleteTeam({ teamId: team.id })}
					/>
				</HStack>
			</HStack>
			{invite !== undefined && (
				<Banner status="info" title="You’re already on a team, so you can’t join another with this invite." />
			)}
			<TeamKeyStatus />
		</>
	);
}

function TeamKeyStatus() {
	const failed = useSelector(teamKeyStore) === 'failed';
	return failed ? (
		<Banner status="error" role="alert" title="Couldn’t unlock your team’s encryption key on this device." />
	) : null;
}
