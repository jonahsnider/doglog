import { useMutation, useQuery } from 'convex/react';
import { FramePanel } from '@/components/ui/frame';
import { api } from '../../../cloud/convex/_generated/api.js';
import { ConfirmCloudAction } from './confirm-cloud-action';

export function TeamMembers() {
	const roster = useQuery(api.teams.listMembers);
	const promote = useMutation(api.teams.promote);
	const demote = useMutation(api.teams.demote);
	const removeMember = useMutation(api.teams.removeMember);
	if (roster === null) {
		return null;
	}
	return (
		<FramePanel className="grid gap-2">
			<h2 className="font-heading font-medium text-base">Team members</h2>
			{roster === undefined ? (
				<p role="status" className="text-muted-foreground text-sm">
					Loading team members…
				</p>
			) : (
				<ul className="divide-y divide-border">
					{roster.members.map((member) => {
						const name = member.displayName ?? 'Unnamed account';
						const isAdmin = member.role === 'admin';
						const label = isAdmin ? (member.isYou ? 'Step down' : 'Remove admin rights') : 'Make admin';
						return (
							<li key={member.id} className="group flex min-h-12 items-center justify-between gap-3 py-2">
								<div className="wrap-anywhere min-w-0 text-sm">
									<p>
										{name}
										{member.isYou && <span className="text-muted-foreground"> (you)</span>}
									</p>
									<p className="text-muted-foreground text-xs">{isAdmin ? 'Admin' : 'Member'}</p>
								</div>
								<div className="flex gap-2 [@media(hover:hover)]:opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
									{(isAdmin ? roster.canDemote : roster.canPromote) && (
										<ConfirmCloudAction
											key={member.role}
											label={label}
											triggerLabel={member.isYou ? undefined : `${label}: ${name}`}
											title={
												isAdmin
													? member.isYou
														? 'Step down as team admin?'
														: `Remove admin rights from ${name}?`
													: `Make ${name} a team admin?`
											}
											description={
												isAdmin
													? member.isYou
														? 'You’ll stay on the team, but your invite link will stop working.'
														: 'They’ll stay on the team, but their invite link will stop working.'
													: 'Admins can manage team members, invite links, and linked robots.'
											}
											failureMessage="Couldn’t change the team role. Try again."
											onConfirm={() => (isAdmin ? demote : promote)({ membershipId: member.id })}
										/>
									)}
									{roster.canRemove && !member.isYou && (
										<ConfirmCloudAction
											label="Remove"
											triggerLabel={`Remove ${name} from the team`}
											title={`Remove ${name} from the team?`}
											description="They’ll lose access to the team’s Cloud dashboards, and the team’s encryption key will be replaced. They can rejoin later with an invite link."
											failureMessage="Couldn’t remove the member. Try again."
											destructive
											onConfirm={() => removeMember({ membershipId: member.id })}
										/>
									)}
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</FramePanel>
	);
}
