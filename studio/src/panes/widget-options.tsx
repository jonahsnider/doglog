import { IconButton } from '@astryxdesign/core/IconButton';
import {
	DropdownMenu,
	DropdownMenuDivider,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from '@astryxdesign/core/DropdownMenu';
import { Field } from '@astryxdesign/core/Field';
import { VStack } from '@astryxdesign/core/Layout';
import { Popover } from '@astryxdesign/core/Popover';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import SettingsIcon from 'lucide-react/icons/settings';
import { useSelector } from '@tanstack/react-store';
import { type ReactNode, useId } from 'react';
import { useMobileLayout } from '@/lib/mobile-layout';
import type { Widget } from '@/panes/layout';
import { paneIconSize } from '@/panes/pane-button';
import { widgetOptionsPane } from '@/panes/widget-options-handle';
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
	const open = useSelector(widgetOptionsPane, (shown) => shown === paneId);
	const setOpen = (next: boolean) => widgetOptionsPane.set(next ? paneId : undefined);
	return (
		<Popover
			isOpen={open}
			onOpenChange={setOpen}
			label="Widget options"
			alignment="end"
			width={320}
			content={
				<VStack gap={3}>
					{options.map((option) =>
						option.kind === 'text' ? (
							option.control && (
								<option.control
									key={option.id}
									paneId={paneId}
									values={values}
									setOption={onOptionChange}
									closeOptions={() => setOpen(false)}
								/>
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
				</VStack>
			}
		>
			<IconButton
				label="Widget options"
				tooltip="Widget options"
				icon={<SettingsIcon size={paneIconSize} aria-hidden />}
				variant="ghost"
			/>
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
		return (
			<Selector
				label={option.label}
				size="sm"
				width="100%"
				options={choices.map(({ id, label }) => ({ value: id, label }))}
				value={value}
				onChange={change}
			/>
		);
	}

	return (
		<ChoiceField label={option.label}>
			<SegmentedControl label={option.label} size="sm" value={value} onChange={change}>
				{choices.map((choice) => (
					<SegmentedControlItem key={choice.id} value={choice.id} label={choice.label} />
				))}
			</SegmentedControl>
		</ChoiceField>
	);
}

/** A labeled group of choices, whose controls name themselves with the label too */
function ChoiceField({ label, children }: { label: string; children: ReactNode }) {
	const id = useId();
	return (
		<Field label={label} inputID={id} labelID={`${id}-label`} isGroupLabel>
			{children}
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
	const label = option.choices.find((choice) => choice.id === value)?.label ?? value;
	return (
		<ChoiceField label={option.label}>
			<DropdownMenu button={{ label, width: '100%', size: 'sm', 'aria-label': `${option.label}: ${label}` }}>
				<DropdownMenuRadioGroup
					label={option.label}
					value={value}
					onChange={(next) => onChange(next === option.default ? undefined : next)}
				>
					{option.choices.map((choice) => (
						<DropdownMenuRadioItem key={choice.id} value={choice.id} label={choice.label} />
					))}
					<menu.Choices />
				</DropdownMenuRadioGroup>
				<DropdownMenuDivider />
				<menu.Commands value={value} pick={onChange} />
			</DropdownMenu>
		</ChoiceField>
	);
}
