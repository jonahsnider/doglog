import { RobotChoices, RobotCommands } from '@/widgets/robot/robot-option-menu';
import type { WidgetOption } from '@/widgets/widget-type';

/** The robot drawn without a model */
export const defaultRobot = 'swerve';

/** The robot drawn in 3D, the simple swerve robot or the robot of a project the user added */
export const robotOption: WidgetOption = {
	kind: 'choice',
	id: 'robot',
	label: 'Robot',
	choices: [{ id: defaultRobot, label: 'Simple swerve' }],
	default: defaultRobot,
	menu: { Choices: RobotChoices, Commands: RobotCommands },
};
