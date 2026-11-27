import { currentCloudScope } from '@/cloud/session';
import type { DashboardSharing } from '@/dashboards/doc';
import { getRobotHost } from '@/robot-target';
import { robotTargetStore } from '@/settings';

/**
 * The robot host that shared dashboards are scoped to, from the robot connection setting. `undefined` when no robot is
 * set, since simulators are never used for sharing.
 */
export function sharingScope(): string | undefined {
	return getRobotHost(robotTargetStore.get());
}

/** Dashboards on this device, and ones shared on the current robot or with the team, unless someone deleted them */
export function isShown({ scope, deletedAt }: DashboardSharing): boolean {
	const shared = scope === sharingScope() || scope === currentCloudScope();
	return scope === undefined || (shared && deletedAt === undefined);
}
