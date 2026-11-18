import { ChevronsUpDownIcon, Settings2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Fieldset, FieldsetLegend } from '@/components/ui/fieldset';
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { ToolbarButton } from '@/components/ui/toolbar';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import type { Widget } from '@/panes/layout';
import { inferredOption, optionValues, pickedOption } from '@/widgets/options';
import type { OptionMenu, WidgetBinding, WidgetOption, WidgetType } from '@/widgets/widget-type';

/** The Auto choice's value in the controls, no choice has an empty ID */
const auto = '';

type WidgetOptionsProps = {
	type: WidgetType;
	widget: Widget | undefined;
	bindings: readonly WidgetBinding[];
	onOptionChange: (id: string, value: string | undefined) => void;
};

/** The widget options button for a pane toolbar, for widgets with options */
export function WidgetOptions({ type, widget, bindings, onOptionChange }: WidgetOptionsProps) {
	const { options = [] } = type;
	const values = optionValues(type, widget, bindings);
	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={<ToolbarButton render={<Button variant="ghost" size="icon-xs" />} aria-label="Widget options" />}
						/>
					}
				>
					<Settings2Icon />
				</TooltipTrigger>
				<TooltipPopup>Widget options</TooltipPopup>
			</Tooltip>
			<PopoverPopup align="end" className="w-80">
				<div className="flex flex-col gap-3">
					{options.map((option) =>
						option.menu ? (
							<MenuOptionControl
								key={option.id}
								option={option}
								menu={option.menu}
								value={values[option.id] ?? option.default}
								onChange={(value) => onOptionChange(option.id, value)}
							/>
						) : (
							<OptionControl
								key={option.id}
								option={option}
								picked={pickedOption(widget, option)}
								inferred={inferredOption(option, bindings, values)}
								onChange={(value) => onOptionChange(option.id, value)}
							/>
						),
					)}
				</div>
			</PopoverPopup>
		</Popover>
	);
}

function OptionControl({
	option,
	picked,
	inferred,
	onChange,
}: {
	option: WidgetOption;
	picked: string | undefined;
	inferred: string | undefined;
	onChange: (value: string | undefined) => void;
}) {
	const choices =
		inferred === undefined
			? option.choices
			: [
					{
						id: auto,
						label: `Auto (${option.choices.find((choice) => choice.id === inferred)?.label ?? inferred})`,
					},
					...option.choices,
				];
	return (
		<Field name={option.id}>
			<Fieldset>
				<FieldsetLegend className="mb-1 text-sm">{option.label}</FieldsetLegend>
				<SegmentedControl
					size="sm"
					render={
						<RadioGroup
							className="flex-row gap-0.5"
							value={picked ?? (inferred === undefined ? option.default : auto)}
							onValueChange={(value: string) => onChange(value === auto ? undefined : value)}
						/>
					}
				>
					{choices.map((choice) => (
						<SegmentedControlItem key={choice.id} render={<RadioPrimitive.Root value={choice.id} />}>
							{choice.label}
						</SegmentedControlItem>
					))}
				</SegmentedControl>
			</Fieldset>
		</Field>
	);
}

/** An option whose choices are listed in a menu, with more from the user's files and commands, see `WidgetOption.menu` */
function MenuOptionControl({
	option,
	menu,
	value,
	onChange,
}: {
	option: WidgetOption;
	menu: OptionMenu;
	value: string;
	onChange: (value: string | undefined) => void;
}) {
	return (
		<Field name={option.id}>
			<Fieldset>
				<FieldsetLegend className="mb-1 text-sm">{option.label}</FieldsetLegend>
				<Menu>
					<MenuTrigger render={<Button variant="outline" size="sm" className="w-full justify-between" />}>
						<span className="truncate">{option.choices.find((choice) => choice.id === value)?.label ?? value}</span>
						<ChevronsUpDownIcon />
					</MenuTrigger>
					<MenuPopup align="start">
						<MenuRadioGroup
							value={value}
							onValueChange={(next: string) => onChange(next === option.default ? undefined : next)}
						>
							{option.choices.map((choice) => (
								<MenuRadioItem key={choice.id} value={choice.id} closeOnClick>
									{choice.label}
								</MenuRadioItem>
							))}
							<menu.Choices />
						</MenuRadioGroup>
						<MenuSeparator />
						<menu.Commands value={value} pick={onChange} />
					</MenuPopup>
				</Menu>
			</Fieldset>
		</Field>
	);
}
