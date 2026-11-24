import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FramePanel } from '@/components/ui/frame';
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
			<FramePanel className="grid gap-3">
				{pending.map(({ id, teamName }) => (
					<PendingJoin key={id} id={id} teamName={teamName} />
				))}
				<p className="text-muted-foreground text-sm">
					You’ll be added automatically when a teammate opens the Cloud page in DogLog Studio.
				</p>
			</FramePanel>
		);
	}
	if (invite === undefined || preview === undefined) {
		return null;
	}
	return (
		<FramePanel className="grid justify-items-start gap-3">
			{preview === null ? (
				<p role="alert" className="text-sm">
					This invite link is no longer valid. Ask a team admin for a new one.
				</p>
			) : (
				<>
					<p className="wrap-anywhere text-sm">You’re invited to join {preview.teamName}.</p>
					<Button loading={joining} onClick={() => void join(invite)}>
						Join team
					</Button>
					{joinError !== undefined && (
						<p role="alert" className="text-destructive-foreground text-sm">
							{joinError}
						</p>
					)}
				</>
			)}
		</FramePanel>
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
		<div className="grid gap-1">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p role="status" className="wrap-anywhere min-w-0 text-sm">
					Waiting to join {teamName}
				</p>
				<Button
					variant="outline"
					size="sm"
					aria-label={`Cancel join for ${teamName}`}
					loading={status === 'canceling'}
					onClick={() => void cancelJoin()}
				>
					Cancel join
				</Button>
			</div>
			{status === 'error' && (
				<p role="alert" className="text-destructive-foreground text-sm">
					Couldn’t cancel the join. Try again.
				</p>
			)}
		</div>
	);
}
