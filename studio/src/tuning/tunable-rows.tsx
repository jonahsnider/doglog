import { Switch } from '@astryxdesign/core/Switch';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { TextMorph } from '@/components/text-morph';
import { inferUnit } from '@/data/units';
import { roundText } from '@/tuning/expression';
import {
	currentValue,
	defaultValue,
	type Draft,
	isExpression,
	formatTunableValue,
	parseTunableValue,
	shownDraft,
	type Tunable,
	type TunableScalar,
	type TunableValue,
} from '@/tuning/tunables';
import './tuning.css';

/** The tuning widget's staged values and drafts, and how to change them */
export type Editing = {
	staged: Readonly<Record<string, TunableValue>>;
	/** Staged values the robot's value changed under since they were staged */
	stale: ReadonlySet<string>;
	drafts: Readonly<Record<string, Draft>>;
	/** Values before they were last applied, see `previousStore` */
	previous: Readonly<Record<string, TunableValue>>;
	/** Type in a value's fields, `undefined` unstages it */
	edit: (tunable: Tunable, draft: Draft | undefined) => void;
	/** Replace what's typed with the values it stands for, ex. `10 + 1` with `11`, see `committedDraft()` */
	commit: (tunable: Tunable) => void;
};

export const rowClassName = 'tunable-row';

type Note = { text: string; warning?: boolean; morphKey?: string };

/** Notes about a value or the widget, separated by commas, `false` ones are left out */
export function Notes({ notes, className }: { notes: readonly (Note | false)[]; className?: string }) {
	return (
		<span className={className}>
			{notes
				.filter((note) => note !== false)
				.map(({ text, warning, morphKey }, index) => {
					const Label = morphKey === undefined ? 'span' : TextMorph;
					return (
						<Fragment key={morphKey ?? text}>
							{index > 0 && ', '}
							<Label className={warning === true ? 'tunable-warning' : undefined}>{text}</Label>
						</Fragment>
					);
				})}
		</span>
	);
}

/**
 * The field of a value, or of one of an array's elements, its number rounded until it's focused. `onFocused` focuses
 * it as it's shown.
 */
export function ValueField({
	tunable,
	editing,
	label,
	text,
	value,
	changed,
	onTextChange,
	onFocused,
	placeholder,
}: {
	tunable: Tunable;
	editing: Editing;
	label: string;
	text: string;
	value: TunableScalar | undefined;
	changed: boolean;
	onTextChange: (text: string) => void;
	onFocused?: (() => void) | undefined;
	/** The value in the robot's code, see `defaultValue()` */
	placeholder: string;
}) {
	const [focused, setFocused] = useState(false);
	// Tabbing in selects the rounded number, the whole number is selected once it's shown so typing replaces it
	const selectWhenShown = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		if (focused) {
			selectWhenShown.current?.select();
		}
		selectWhenShown.current = null;
	}, [focused]);
	if (tunable.scalarType === 'boolean') {
		return (
			<div className="justify-self-end">
				<Switch
					label={label}
					isLabelHidden
					size="sm"
					value={value === true}
					isDisabled={!tunable.mutable}
					onChange={(checked) => onTextChange(String(checked))}
				/>
			</div>
		);
	}
	return (
		<TextInput
			ref={
				onFocused &&
				((element) => {
					element?.focus();
					onFocused();
				})
			}
			label={label}
			isLabelHidden
			size="sm"
			width="100%"
			status={value === undefined ? { type: 'error', message: 'Invalid value' } : undefined}
			statusVariant="tooltip"
			placeholder={placeholder}
			isDisabled={!tunable.mutable}
			hasSpellCheck={false}
			containerClassName="tunable-field"
			// An invalid value shows as invalid instead
			controlClassName={changed && value !== undefined ? 'tunable-field-changed' : undefined}
			value={focused || tunable.scalarType === 'string' ? text : roundText(text)}
			onChange={onTextChange}
			onFocus={(event) => {
				const input = event.target;
				if (!(input instanceof HTMLInputElement)) {
					return;
				}
				const selectedAll = input.selectionStart === 0 && input.selectionEnd === input.value.length;
				selectWhenShown.current = selectedAll ? input : null;
				setFocused(true);
			}}
			onBlur={() => {
				setFocused(false);
				editing.commit(tunable);
			}}
			onKeyDown={(event) => {
				if (event.key === 'Enter') {
					editing.commit(tunable);
				} else if (event.key === 'Escape') {
					editing.edit(tunable, undefined);
				}
			}}
		/>
	);
}

export function ScalarRow({ tunable, editing }: { tunable: Tunable; editing: Editing }) {
	const { name } = tunable.entry;
	const { staged, drafts, previous } = editing;
	const current = currentValue(tunable);
	const isStaged = name in staged;
	const shown = isStaged ? staged[name] : current;
	const draft = shownDraft(tunable, drafts[name], shown);
	const text = typeof draft === 'string' ? draft : formatTunableValue(shown);
	const value = parseTunableValue(tunable, text);
	const unit =
		tunable.scalarType === 'string' || tunable.scalarType === 'boolean' ? undefined : inferUnit(tunable.entry);
	const applied = formatTunableValue(current, { rounded: true });
	return (
		<div className={`grid grid-cols-[minmax(0,1fr)_auto_7.5rem_3.75rem] ${rowClassName}`}>
			<span className="truncate" title={name}>
				{tunable.label}
			</span>
			<Notes
				className="tunable-code"
				notes={[
					isExpression(tunable, text, value) && { text: `= ${formatTunableValue(value, { rounded: true })}` },
					isStaged &&
						(editing.stale.has(name)
							? { text: `changed to ${applied}`, warning: true }
							: { text: `applied ${applied}` }),
					name in previous && { text: `was ${formatTunableValue(previous[name], { rounded: true })}` },
				]}
			/>
			<ValueField
				tunable={tunable}
				editing={editing}
				label={tunable.label}
				text={text}
				value={value}
				changed={isStaged}
				placeholder={formatTunableValue(defaultValue(tunable))}
				onTextChange={(next) => editing.edit(tunable, next)}
			/>
			<span className="tunable-code truncate">{unit?.label}</span>
		</div>
	);
}

/** A table's path, with the tables it's in muted, and `children` at its end */
export function SectionHeading({ table, title, children }: { table: string; title?: string; children?: ReactNode }) {
	const segments = table.split('/');
	return (
		<h3 className="tunable-section-heading" title={title}>
			<span className="tunable-section-path">
				{segments.length > 1 && <span className="tunable-section-parents">{segments.slice(0, -1).join(' / ')} / </span>}
				{segments.at(-1)}
			</span>
			{children}
		</h3>
	);
}
