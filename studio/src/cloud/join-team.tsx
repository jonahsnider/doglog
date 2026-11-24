import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { api } from '../../../cloud/convex/_generated/api.js';

type PendingInvites = FunctionReturnType<typeof api.invites.listPending>;

// Shown to a signed-in account without a team. Joining finishes when a teammate's Studio shares the team key.
export function JoinTeam({ invite, pending }: { invite: string | undefined; pending: PendingInvites | undefined }) {
	const navigate = useNavigate();
	const preview = useQuery(api.invites.preview, invite === undefined ? 'skip' : { token: invite });
	const accept = useMutation(api.invites.accept);
	const [joining, setJoining] = useState(false);
	const [joinError, setJoinError] = useState<string>();

	async function join(token: string) {
		setJoinError(undefined);
		setJoining(true);
		try {
			await accept({ token });
			await navigate({ to: '/cloud', search: {}, replace: true });
		} catch (error) {
			setJoinError(
				error instanceof ConvexError && typeof error.data === 'string'
					? error.data
					: 'Couldn’t join the team. Try again.',
			);
		}
		setJoining(false);
	}

	if (pending !== undefined && pending.length > 0) {
		return (
			<VStack gap={3}>
				{pending.map(({ id, teamName }) => (
					<PendingJoin key={id} id={id} teamName={teamName} />
				))}
				<Text type="supporting" color="secondary">
					You’ll be added automatically when a teammate opens the Cloud page in DogLog Studio.
				</Text>
			</VStack>
		);
	}
	if (invite === undefined || preview === undefined) {
		return null;
	}
	return (
		<VStack gap={3} hAlign="start">
			{preview === null ? (
				<Banner
					status="warning"
					role="alert"
					title="This invite link is no longer valid. Ask a team admin for a new one."
				/>
			) : (
				<>
					<Text>You’re invited to join {preview.teamName}.</Text>
					<Button label="Join team" variant="primary" isLoading={joining} onClick={() => void join(invite)} />
					{joinError !== undefined && <Banner status="error" role="alert" title={joinError} />}
				</>
			)}
		</VStack>
	);
}

function PendingJoin({ id, teamName }: PendingInvites[number]) {
	const cancel = useMutation(api.invites.cancel);
	const [status, setStatus] = useState<'canceling' | 'error'>();

	async function cancelJoin() {
		setStatus('canceling');
		try {
			await cancel({ pendingJoinId: id });
			setStatus(undefined);
		} catch {
			setStatus('error');
		}
	}

	return (
		<VStack gap={2}>
			<HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
				<Text role="status">Waiting to join {teamName}</Text>
				<Button
					label={`Cancel join for ${teamName}`}
					size="sm"
					isLoading={status === 'canceling'}
					onClick={() => void cancelJoin()}
				>
					Cancel join
				</Button>
			</HStack>
			{status === 'error' && <Banner status="error" role="alert" title="Couldn’t cancel the join. Try again." />}
		</VStack>
	);
}
