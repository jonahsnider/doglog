import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FramePanel } from '@/components/ui/frame';
import { api } from '../../../cloud/convex/_generated/api.js';

// Shown to a signed-in account without a team. Joining finishes when a teammate's Studio shares the team key.
export function JoinTeam({ invite }: { invite: string | undefined }) {
	const navigate = useNavigate();
	const pending = useQuery(api.invites.listPending);
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
			<FramePanel className="grid gap-1">
				{pending.map(({ id, teamName }) => (
					<p key={id} role="status" className="wrap-anywhere text-sm">
						Waiting to join {teamName}
					</p>
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
