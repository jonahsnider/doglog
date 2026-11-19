import type { AlertLevel, RobotMode } from '@/timeline/events';

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

export const shiftColor = 'bg-fuel ring-1 ring-fuel-outline ring-inset';
