import type { AlertLevel, RobotMode } from '@/timeline/events';

// Disabled is left as the empty track
export const modeColors: Record<RobotMode, string | undefined> = {
	disabled: undefined,
	auto: 'bg-success',
	teleop: 'bg-info',
	test: 'bg-test-mode',
	estop: 'bg-destructive',
};

export const modeLabels: Record<RobotMode, string> = {
	disabled: 'Disabled',
	auto: 'Autonomous',
	teleop: 'Teleop',
	test: 'Test',
	estop: 'E-stopped',
};

export const alertColors: Record<AlertLevel, string> = { error: 'bg-destructive', warning: 'bg-warning' };
