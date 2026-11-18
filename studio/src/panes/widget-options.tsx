import { Settings2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Fieldset, FieldsetLegend } from '@/components/ui/fieldset';
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { ToolbarButton } from '@/components/ui/toolbar';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import type { Widget } from '@/panes/layout';
import { inferredOption, optionValues, pickedOption } from '@/widgets/options';
import type { WidgetBinding, WidgetOption, WidgetType } from '@/widgets/widget-type';

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
					{options.map((option) => (
						<OptionControl
							key={option.id}
							option={option}
							picked={pickedOption(widget, option)}
							inferred={inferredOption(option, bindings, values)}
							onChange={(value) => onOptionChange(option.id, value)}
						/>
					))}
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
