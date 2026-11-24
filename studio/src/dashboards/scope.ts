import { currentCloudScope } from '@/cloud/session';
import type { DashboardSharing } from '@/dashboards/doc';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { settingsStore } from '@/settings';

/** The robot host that shared dashboards are scoped to, from the robot connection setting. The simulator counts as the robot. */
export function sharingScope(): string {
	return getRobotHost(settingsStore.get().robotTarget) ?? simulatorHost;
}

/** Dashboards on this device, and ones shared on the current robot or with the team, unless someone deleted them */
export function isShown({ scope, deletedAt }: DashboardSharing): boolean {
	const shared = scope === sharingScope() || scope === currentCloudScope();
	return scope === undefined || (shared && deletedAt === undefined);
}
