import type { RobotProject } from '@/three/robot-projects';
import { widgetOptions } from '@/widgets/widget-info';
import type { WidgetBinding } from '@/widgets/widget-type';

/** The robot drawn without a model */
export const defaultRobot = widgetOptions.robot.robot.default;

export function isRobotBinding(binding: WidgetBinding): boolean {
	return binding.role?.id === 'robot' || binding.role?.id === 'ghost';
}

/** The robot a robot or ghost binding is drawn as in 3D: its own pick, the first robot's, or the simple swerve robot */
export function fieldRobot(binding: WidgetBinding, bindings: readonly WidgetBinding[]): string {
	return binding.robot ?? bindings.find((other) => other.role?.id === 'robot')?.robot ?? defaultRobot;
}

/** Notes for robots whose project isn't added on this device, which are drawn as the simple swerve robot */
export function missingRobotNotes(
	bindings: readonly WidgetBinding[],
	projects: readonly RobotProject[] | undefined,
): Map<string, string> {
	const notes = new Map<string, string>();
	for (const binding of bindings) {
		const robot = isRobotBinding(binding) ? fieldRobot(binding, bindings) : defaultRobot;
		if (robot !== defaultRobot && projects?.some((project) => project.name === robot) === false) {
			notes.set(binding.id, 'Robot not added');
		}
	}
	return notes;
}
