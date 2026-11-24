import { useSelector } from '@tanstack/react-store';
import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { FramePanel } from '@/components/ui/frame';
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
	return (
		<FramePanel>
			{team === undefined ? (
				<p role="status" className="text-muted-foreground text-sm">
					Loading your team…
				</p>
			) : team === null ? (
				<CreateTeam />
			) : (
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="grid min-w-0 gap-1">
						<h3 className="wrap-anywhere font-heading font-medium text-base">{team.name}</h3>
						<p className="text-muted-foreground text-sm">{team.role === 'admin' ? 'Team admin' : 'Team member'}</p>
						{invite !== undefined && (
							<p role="status" className="text-sm">
								You’re already on a team, so you can’t join another with this invite.
							</p>
						)}
						<TeamKeyStatus />
					</div>
					{team.canDelete && (
						<ConfirmCloudAction
							key={team.id}
							label="Delete team"
							title={`Delete ${team.name}?`}
							description="This permanently deletes the team and its Cloud dashboards and invalidates its invite links. You’ll keep your Cloud account and local dashboards."
							failureMessage="Couldn’t delete the team. Try again."
							destructive
							onConfirm={() => deleteTeam({ teamId: team.id })}
						/>
					)}
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
				</div>
			)}
		</FramePanel>
	);
}

function TeamKeyStatus() {
	const failed = useSelector(teamKeyStore) === 'failed';
	return failed ? (
		<p role="alert" className="text-destructive-foreground text-sm">
			Couldn’t unlock your team’s encryption key on this device.
		</p>
	) : null;
}
