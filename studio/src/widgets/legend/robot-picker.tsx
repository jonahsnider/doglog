import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import { use } from 'react';
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { WidgetBindingsContext } from '@/entries/drag';
import { RobotChoices, RobotCommands } from '@/widgets/robot/robot-option-menu';
import { widgetOptions } from '@/widgets/widget-info';
import type { WidgetBinding } from '@/widgets/widget-type';

const { choices } = widgetOptions.robot.robot;

/** Picks the robot a binding is drawn as, with the robot widget's Robot option's choices and commands */
export function RobotPicker({ binding, robot }: { binding: WidgetBinding; robot: string }) {
	const widget = use(WidgetBindingsContext);
	const pick = (next: string | undefined) => widget?.setRobot(binding.id, next);
	return (
		<Menu>
			<MenuTrigger
				className="-mx-1 flex min-w-0 shrink-0 cursor-pointer items-center gap-0.5 rounded-sm px-1 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-accent-foreground"
				aria-label={`Draw ${binding.name} as`}
			>
				<span className="truncate">{choices.find((choice) => choice.id === robot)?.label ?? robot}</span>
				<ChevronDownIcon className="size-3 shrink-0" />
			</MenuTrigger>
			<MenuPopup align="end">
				<MenuRadioGroup value={robot} onValueChange={(next: string) => pick(next)}>
					{choices.map((choice) => (
						<MenuRadioItem key={choice.id} value={choice.id} closeOnClick>
							{choice.label}
						</MenuRadioItem>
					))}
					<RobotChoices />
				</MenuRadioGroup>
				<MenuSeparator />
				<RobotCommands value={robot} pick={pick} />
			</MenuPopup>
		</Menu>
	);
}
