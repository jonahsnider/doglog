import ChevronsUpDownIcon from 'lucide-react/icons/chevrons-up-down';
import SettingsIcon from 'lucide-react/icons/settings';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Fieldset, FieldsetLegend } from '@/components/ui/fieldset';
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToolbarButton } from '@/components/ui/toolbar';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { useMobileLayout } from '@/lib/mobile-layout';
import type { Widget } from '@/panes/layout';
import { inferredOption, optionValues, pickedOption } from '@/widgets/options';
import type { OptionMenu, WidgetBinding, WidgetOption, WidgetType } from '@/widgets/widget-type';

/** The Auto choice's value in the controls, no choice has an empty ID */
const auto = '';

type WidgetOptionsProps = {
	paneId: string;
	type: WidgetType;
	widget: Widget | undefined;
	bindings: readonly WidgetBinding[];
	onOptionChange: (id: string, value: string | undefined) => void;
};

/** The widget options button for a pane toolbar, for widgets with options */
export function WidgetOptions({ paneId, type, widget, bindings, onOptionChange }: WidgetOptionsProps) {
	const { options = [] } = type;
	const mobile = useMobileLayout();
	const values = optionValues(type, widget, bindings, mobile);
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
					<SettingsIcon aria-hidden />
				</TooltipTrigger>
				<TooltipPopup>Widget options</TooltipPopup>
			</Tooltip>
			<PopoverPopup align="end" className="w-80">
				<div className="flex flex-col gap-3">
					{options.map((option) =>
						option.kind === 'text' ? (
							option.control && (
								<option.control key={option.id} paneId={paneId} values={values} setOption={onOptionChange} />
							)
						) : option.menu ? (
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
								inferred={inferredOption(option, bindings, values, mobile)}
								onChange={(value) => onOptionChange(option.id, value)}
							/>
						),
					)}
				</div>
			</PopoverPopup>
		</Popover>
	);
}

/** An option picked from choices */
type ChoiceOption = Extract<WidgetOption, { kind: 'choice' }>;

function OptionControl({
	option,
	picked,
	inferred,
	onChange,
}: {
	option: ChoiceOption;
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
	const value = picked ?? (inferred === undefined ? option.default : auto);
	const change = (next: string | null) => {
		if (next !== null) {
			onChange(next === auto ? undefined : next);
		}
	};
	if (option.dropdown) {
		const items = choices.map(({ id, label }) => ({ value: id, label }));
		return (
			<Field name={option.id} className="items-stretch gap-1">
				<FieldLabel className="font-semibold">{option.label}</FieldLabel>
				<Select items={items} value={value} onValueChange={change}>
					<SelectTrigger size="sm">
						<SelectValue />
					</SelectTrigger>
					<SelectPopup alignItemWithTrigger={false}>
						{items.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>
			</Field>
		);
	}

	return (
		<Field name={option.id}>
			<Fieldset>
				<FieldsetLegend className="mb-1 text-sm">{option.label}</FieldsetLegend>
				<SegmentedControl
					size="sm"
					render={<RadioGroup className="flex-row gap-0.5" value={value} onValueChange={change} />}
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
	option: ChoiceOption;
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
