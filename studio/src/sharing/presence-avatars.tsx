import { Avatar } from '@astryxdesign/core/Avatar';
import { AvatarGroup, AvatarGroupOverflow } from '@astryxdesign/core/AvatarGroup';
import fnv1a from '@sindresorhus/fnv1a';
import { durationVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { TextMorph } from '@/components/text-morph';
import { type PresentSession, usePresence } from '@/sharing/presence';
import { chartCount } from '@/theme/choices';
import { seriesColor } from '@/widgets/series-color';
import './presence-avatars.css';

const styles = stylex.create({
	group: { display: 'flex' },
	pane: { marginInlineEnd: spacingVars['--spacing-1'] },
	// Each user's color is a series color, see presence-avatars.css
	color: (color: string) => ({
		backgroundColor: color,
	}),
	avatar: {
		transitionProperty: 'opacity, filter',
		transitionDuration: durationVars['--duration-fast'],
	},
	inactive: {
		opacity: 0.4,
		filter: 'grayscale(1)',
	},
	count: {
		fontVariantNumeric: 'tabular-nums',
	},
});

const maxShown = 3;

function userColor(userId: string): string {
	return seriesColor(Number(fnv1a(userId, { size: 32 }) % BigInt(chartCount)));
}

/** Other users in a shared dashboard or pane. Sessions other than each user's active one are grayed out. */
function PresenceAvatars({
	sessions,
	xstyle,
	className,
}: {
	sessions: readonly PresentSession[];
	xstyle?: stylex.StyleXStyles;
	/** Global hooks, ex. `capture-invisible` */
	className?: string;
}) {
	if (sessions.length === 0) {
		return null;
	}

	// One more avatar would take the count's place
	const shown = sessions.length > maxShown + 1 ? sessions.slice(0, maxShown) : sessions;
	const sx = stylex.props(styles.group, xstyle);
	return (
		<div {...sx} className={className === undefined ? sx.className : `${sx.className} ${className}`}>
			<AvatarGroup size="xsm">
				{shown.map((session) => (
					<Avatar
						key={session.sessionId}
						name={session.name}
						data-presence-avatar
						tooltip={session.active ? session.name : `${session.name} (inactive)`}
						xstyle={[styles.avatar, styles.color(userColor(session.userId)), !session.active && styles.inactive]}
					/>
				))}
				{shown.length < sessions.length && (
					<AvatarGroupOverflow count={sessions.length - shown.length}>
						<span {...stylex.props(styles.count)}>
							<TextMorph>{`+${sessions.length - shown.length}`}</TextMorph>
						</span>
					</AvatarGroupOverflow>
				)}
			</AvatarGroup>
		</div>
	);
}

/** Other users whose last interaction in a shared dashboard was with this pane */
export function PanePresence({ dashboardId, paneId }: { dashboardId: string; paneId: string }) {
	const sessions = usePresence(dashboardId).filter((session) => session.paneId === paneId);
	return <PresenceAvatars sessions={sessions} xstyle={styles.pane} className="capture-invisible" />;
}

/** Other users in a shared dashboard, once each, active if any of their sessions in it is */
export function DashboardPresence({ dashboardId }: { dashboardId: string }) {
	const sessions = usePresence(dashboardId);
	const users = new Map<string, PresentSession>();
	for (const session of sessions) {
		const other = users.get(session.userId);
		if (!other || (session.active && !other.active)) {
			users.set(session.userId, session);
		}
	}
	return <PresenceAvatars sessions={[...users.values()]} />;
}
