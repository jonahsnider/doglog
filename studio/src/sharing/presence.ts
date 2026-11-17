import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';

/** A tab or window of another user, viewing a shared dashboard */
export type Session = {
	userId: string;
	sessionId: string;
	name: string;
	dashboardId: string;
	/** The pane they last interacted with */
	paneId?: string | undefined;
	/** When they last focused or used the session, in milliseconds since the epoch */
	lastActiveAt: number;
};

/** Other users' sessions, by the NT topic they publish them on */
export const sessionsStore = createAtom<ReadonlyMap<string, Session>>(new Map());

/** The dashboard this window shows, and when the user last focused or used it */
export const localActivityStore = createAtom<{ dashboardId: string | undefined; lastActiveAt: number }>({
	dashboardId: undefined,
	lastActiveAt: Date.now(),
});

/** Call when this window shows a dashboard, or `undefined` when it stops */
export function setViewedDashboard(dashboardId: string | undefined): void {
	localActivityStore.set((activity) => ({ ...activity, dashboardId }));
}

/** Activity more often than this doesn't update `lastActiveAt`, others only see it twice a second anyway */
const activityInterval = 1000;

function markActive(): void {
	const now = Date.now();
	if (now - localActivityStore.get().lastActiveAt >= activityInterval) {
		localActivityStore.set((activity) => ({ ...activity, lastActiveAt: now }));
	}
}

/** Mark this window active whenever it's focused or used, so others see which of a user's windows they're using */
export function trackActivity(): void {
	for (const type of ['focus', 'pointerdown', 'pointermove', 'keydown', 'wheel'] as const) {
		window.addEventListener(type, markActive, { capture: true, passive: true });
	}
}

/** A session shown in a shared dashboard. Only each user's most recently active session is active. */
export type PresentSession = Session & { active: boolean };

function presentSessions(sessions: ReadonlyMap<string, Session>, dashboardId: string): PresentSession[] {
	// Users can have sessions in several dashboards, their active one might be elsewhere
	const latest = new Map<string, number>();
	for (const session of sessions.values()) {
		latest.set(session.userId, Math.max(latest.get(session.userId) ?? 0, session.lastActiveAt));
	}

	const present: PresentSession[] = [];
	for (const session of sessions.values()) {
		if (session.dashboardId === dashboardId) {
			present.push({ ...session, active: session.lastActiveAt === latest.get(session.userId) });
		}
	}
	return present.toSorted((a, b) => a.name.localeCompare(b.name) || a.sessionId.localeCompare(b.sessionId));
}

function sameSessions(a: readonly PresentSession[], b: readonly PresentSession[]): boolean {
	return (
		a.length === b.length &&
		a.every((session, index) => {
			const other = b[index];
			return (
				other !== undefined &&
				session.sessionId === other.sessionId &&
				session.name === other.name &&
				session.paneId === other.paneId &&
				session.active === other.active
			);
		})
	);
}

/** Other users' sessions in a shared dashboard */
export function usePresence(dashboardId: string): PresentSession[] {
	return useSelector(sessionsStore, (sessions) => presentSessions(sessions, dashboardId), { compare: sameSessions });
}
