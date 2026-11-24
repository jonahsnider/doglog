import { HStack } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { useMutation, useQuery } from 'convex/react';
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
		<List header="Team members" hasDividers edge="flush">
			{roster === undefined ? (
				<ListItem label={<Text role="status">Loading team members…</Text>} />
			) : (
				<>
					{roster.members.map((member) => {
						const name = member.displayName ?? 'Unnamed account';
						const isAdmin = member.role === 'admin';
						const label = isAdmin ? (member.isYou ? 'Step down' : 'Remove admin rights') : 'Make admin';
						return (
							<ListItem
								key={member.id}
								label={
									<>
										{name}
										{member.isYou && <Text color="secondary"> (you)</Text>}
									</>
								}
								description={isAdmin ? 'Admin' : 'Member'}
								endContent={
									<HStack gap={2}>
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
									</HStack>
								}
							/>
						);
					})}
				</>
			)}
		</List>
	);
}
