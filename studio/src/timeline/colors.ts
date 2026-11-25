import type { AlertLevel, RobotMode } from '@/timeline/events';

/** The robot's modes' colors, none while it's disabled */
export const modeFills: Record<RobotMode, string | undefined> = {
	disabled: undefined,
	auto: 'var(--color-success)',
	teleop: 'var(--color-info)',
	test: 'var(--test-mode)',
	estop: 'var(--color-error)',
};

export const modeLabels: Record<RobotMode, string> = {
	disabled: 'Disabled',
	auto: 'Autonomous',
	teleop: 'Teleop',
	test: 'Test',
	estop: 'E-stopped',
};

export const alertFills: Record<AlertLevel, string> = { error: 'var(--color-error)', warning: 'var(--color-warning)' };
