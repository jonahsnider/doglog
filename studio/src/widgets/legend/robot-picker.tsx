import {
	DropdownMenuDivider,
	DropdownMenuGroup,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from '@astryxdesign/core/DropdownMenu';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import { use } from 'react';
import { WidgetBindingsContext } from '@/entries/drag';
import { LegendMenu } from '@/widgets/legend/legend-menu';
import { RobotChoices, RobotCommands } from '@/widgets/robot/robot-option-menu';
import { widgetOptions } from '@/widgets/widget-info';
import type { WidgetBinding } from '@/widgets/widget-type';

const { choices } = widgetOptions.robot.robot;

/**
 * Picks the binding's role and the robot it's drawn as in one menu, ex. `581 Comp Bot (ghost)`, with the robot
 * widget's Robot option's choices and commands
 */
export function RobotPicker({ binding, robot }: { binding: WidgetBinding; robot: string }) {
	const widget = use(WidgetBindingsContext);
	const pick = (next: string | undefined) => widget?.setRobot(binding.id, next);
	return (
		<LegendMenu
			label={`Show ${binding.name} as`}
			trigger={
				<>
					<span className="truncate">
						{choices.find((choice) => choice.id === robot)?.label ?? robot}
						{binding.role?.id === 'ghost' && ' (ghost)'}
					</span>
					<ChevronDownIcon className="size-3 shrink-0" />
				</>
			}
		>
			<DropdownMenuGroup title="Show as">
				<DropdownMenuRadioGroup
					label="Show as"
					value={binding.role?.id}
					onChange={(role) => widget?.setRole(binding.id, role)}
				>
					{binding.roles.map((role) => (
						<DropdownMenuRadioItem key={role.id} value={role.id} label={role.label} />
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuGroup>
			<DropdownMenuDivider />
			<DropdownMenuGroup title="Robot">
				<DropdownMenuRadioGroup label="Robot" value={robot} onChange={pick}>
					{choices.map((choice) => (
						<DropdownMenuRadioItem key={choice.id} value={choice.id} label={choice.label} />
					))}
					<RobotChoices />
				</DropdownMenuRadioGroup>
			</DropdownMenuGroup>
			<DropdownMenuDivider />
			<RobotCommands value={robot} pick={pick} />
		</LegendMenu>
	);
}
