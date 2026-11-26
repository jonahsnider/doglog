import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useState } from 'react';
import { AppActionMenu, type MenuAction } from '@/components/app-context-menu';
import { api } from '../../../cloud/convex/_generated/api.js';
import { ConfirmCloudDialog } from './confirm-cloud-action';

type Roster = NonNullable<FunctionReturnType<typeof api.teams.listMembers>>;

export function TeamMembers() {
	const roster = useQuery(api.teams.listMembers);
	if (roster === null) {
		return null;
	}
	return (
		<List header="Team members" hasDividers edge="flush">
			{roster === undefined ? (
				<ListItem label={<Text role="status">Loading team members…</Text>} />
			) : (
				<>
					{roster.members.map((member) => (
						<ListItem
							key={member.id}
							label={
								<>
									{member.displayName ?? 'Unnamed account'}
									{member.isYou && <Text color="secondary"> (you)</Text>}
								</>
							}
							description={member.role === 'admin' ? 'Admin' : 'Member'}
							endContent={<MemberOptions roster={roster} member={member} />}
						/>
					))}
				</>
			)}
		</List>
	);
}

function MemberOptions({ roster, member }: { roster: Roster; member: Roster['members'][number] }) {
	const promote = useMutation(api.teams.promote);
	const demote = useMutation(api.teams.demote);
	const removeMember = useMutation(api.teams.removeMember);
	const [confirming, setConfirming] = useState<'promote' | 'demote' | 'remove'>();

	const name = member.displayName ?? 'Unnamed account';
	const items: MenuAction[] = [];
	if (member.role === 'admin' ? roster.canDemote : roster.canPromote) {
		items.push(
			member.role === 'admin'
				? { label: member.isYou ? 'Step down' : 'Remove admin rights', onSelect: () => setConfirming('demote') }
				: { label: 'Make admin', onSelect: () => setConfirming('promote') },
		);
	}
	if (roster.canRemove && !member.isYou) {
		items.push({ label: 'Remove from team', onSelect: () => setConfirming('remove') });
	}
	if (items.length === 0) {
		return null;
	}

	// One dialog per action, so the text doesn't change as the dialog closes after the role changes
	return (
		<>
			<AppActionMenu label="Member options" accessibleLabel={`Options for ${name}`} items={() => items} />
			<ConfirmCloudDialog
				open={confirming === 'promote'}
				onOpenChange={() => setConfirming(undefined)}
				label="Make admin"
				title={`Make ${name} a team admin?`}
				description="Admins can manage team members, invite links, and linked robots."
				failureMessage="Couldn’t change the team role. Try again."
				onConfirm={() => promote({ membershipId: member.id })}
			/>
			<ConfirmCloudDialog
				open={confirming === 'demote'}
				onOpenChange={() => setConfirming(undefined)}
				label={member.isYou ? 'Step down' : 'Remove admin rights'}
				title={member.isYou ? 'Step down as team admin?' : `Remove admin rights from ${name}?`}
				description={
					member.isYou
						? 'You’ll stay on the team, but your invite link will stop working.'
						: 'They’ll stay on the team, but their invite link will stop working.'
				}
				failureMessage="Couldn’t change the team role. Try again."
				onConfirm={() => demote({ membershipId: member.id })}
			/>
			<ConfirmCloudDialog
				open={confirming === 'remove'}
				onOpenChange={() => setConfirming(undefined)}
				label="Remove"
				title={`Remove ${name} from the team?`}
				description="They’ll lose access to the team’s Cloud dashboards, and the team’s encryption key will be replaced. They can rejoin later with an invite link."
				failureMessage="Couldn’t remove the member. Try again."
				destructive
				onConfirm={() => removeMember({ membershipId: member.id })}
			/>
		</>
	);
}
