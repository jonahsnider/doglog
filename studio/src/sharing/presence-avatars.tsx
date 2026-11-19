import fnv1a from '@sindresorhus/fnv1a';
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type PresentSession, usePresence } from '@/sharing/presence';

/** Chart colors, so each user's color follows the theme and contrasts equally with the background */
const userColors = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'] as const;

const maxShown = 3;

function userColor(userId: string): string {
	return userColors[Number(fnv1a(userId, { size: 32 }) % BigInt(userColors.length))] ?? userColors[0];
}

/** Splits names into characters as people see them, ex. a whole emoji */
const segmenter = new Intl.Segmenter();

function initial(name: string): string {
	const [first] = segmenter.segment(name.trim());
	return first?.segment.toUpperCase() ?? '?';
}

/** Other users in a shared dashboard or pane. Sessions other than each user's active one are grayed out. */
function PresenceAvatars({ sessions, className }: { sessions: readonly PresentSession[]; className?: string }) {
	if (sessions.length === 0) {
		return null;
	}

	// One more avatar would take the count's place
	const shown = sessions.length > maxShown + 1 ? sessions.slice(0, maxShown) : sessions;
	return (
		<AvatarGroup className={cn('[--avatar-size:--spacing(5)]', className)}>
			{shown.map((session) => (
				<Tooltip key={session.sessionId}>
					<TooltipTrigger
						render={
							<Avatar
								aria-label={session.name}
								className={cn('transition-opacity', !session.active && 'opacity-40 grayscale')}
							/>
						}
					>
						<AvatarFallback className={cn('text-primary-foreground', userColor(session.userId))}>
							{initial(session.name)}
						</AvatarFallback>
					</TooltipTrigger>
					<TooltipPopup>{session.active ? session.name : `${session.name} (inactive)`}</TooltipPopup>
				</Tooltip>
			))}
			{shown.length < sessions.length && <AvatarGroupCount>+{sessions.length - shown.length}</AvatarGroupCount>}
		</AvatarGroup>
	);
}

/** Other users whose last interaction in a shared dashboard was with this pane */
export function PanePresence({ dashboardId, paneId }: { dashboardId: string; paneId: string }) {
	const sessions = usePresence(dashboardId).filter((session) => session.paneId === paneId);
	return <PresenceAvatars sessions={sessions} className="me-1" />;
}

/** Other users in a shared dashboard, once each, active if any of their sessions in it is */
export function DashboardPresence({ dashboardId, className }: { dashboardId: string; className?: string }) {
	const sessions = usePresence(dashboardId);
	const users = new Map<string, PresentSession>();
	for (const session of sessions) {
		const other = users.get(session.userId);
		if (!other || (session.active && !other.active)) {
			users.set(session.userId, session);
		}
	}
	return <PresenceAvatars sessions={[...users.values()]} className={className} />;
}
