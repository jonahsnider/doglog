import { RobotChoices, RobotCommands } from '@/widgets/robot/robot-option-menu';
import { widgetOptions } from '@/widgets/widget-info';
import type { WidgetOption } from '@/widgets/widget-type';

/** The robot drawn without a model */
export const defaultRobot = widgetOptions.robot.robot.default;

/** The robot drawn in 3D, the swerve drivebase or the robot of a project the user added */
export const robotOption: WidgetOption = {
	...widgetOptions.robot.robot,
	menu: { Choices: RobotChoices, Commands: RobotCommands },
};
