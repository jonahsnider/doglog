import { Select as SelectPrimitive } from '@base-ui/react/select';
import ChevronsUpDownIcon from 'lucide-react/icons/chevrons-up-down';
import PlusIcon from 'lucide-react/icons/plus';
import XIcon from 'lucide-react/icons/x';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectItem, SelectPopup, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { type Editing, Notes, rowClassName, SectionHeading, ValueField } from '@/tuning/tunable-rows';
import {
	arrayLayouts,
	currentValue,
	defaultValue,
	formatTunableValue,
	parseTunableValue,
	rowSize,
	shownDraft,
	type Tunable,
} from '@/tuning/tunables';
import type { RoleOption } from '@/widgets/widget-type';

const addLabels: Record<string, string> = { list: 'Add value', pairs: 'Add pair', triplets: 'Add triplet' };

/** An array as rows of one element, or of pairs or triplets, with the rows' elements in a row each */
export function ArrayTunable({
	tunable,
	editing,
	layout,
	onLayoutChange,
}: {
	tunable: Tunable;
	editing: Editing;
	layout: RoleOption | undefined;
	onLayoutChange: (layout: string) => void;
}) {
	const { name } = tunable.entry;
	const { staged, drafts, previous } = editing;
	const current = currentValue(tunable);
	// `Array.isArray()` doesn't narrow readonly arrays
	const applied = typeof current === 'object' ? current : [];
	const shown = name in staged ? staged[name] : current;
	const draft = shownDraft(tunable, drafts[name], shown);
	const texts =
		typeof draft === 'object'
			? draft
			: (typeof shown === 'object' ? shown : []).map((element) => formatTunableValue(element));
	const values = texts.map((text) => parseTunableValue(tunable, text));
	const fallback = defaultValue(tunable);
	const defaults = typeof fallback === 'object' ? fallback : [];
	const size = rowSize(layout);
	// The first field of the row just added, focused once it's shown
	const [added, setAdded] = useState<number>();

	const rows: number[] = [];
	for (let start = 0; start < texts.length; start += size) {
		rows.push(start);
	}
	const edit = (next: readonly string[]) => editing.edit(tunable, next);

	return (
		<section>
			<SectionHeading table={tunable.table === '' ? tunable.label : `${tunable.table}/${tunable.label}`} title={name}>
				{/* No unit, its name's is usually only one column's, ex. a distance to RPM map */}
				<Notes
					className="truncate font-mono text-xs font-normal text-muted-foreground tabular-nums"
					notes={[
						texts.length % size !== 0 && {
							text: `${texts.length} values aren't whole ${layout?.label.toLowerCase()}`,
						},
						editing.stale.has(name) && { text: 'changed since staged', warning: true },
						name in previous && { text: `was ${formatTunableValue(previous[name], { rounded: true })}` },
					]}
				/>
				<Select
					items={arrayLayouts.map(({ id, label }) => ({ value: id, label }))}
					value={layout?.id ?? arrayLayouts[0].id}
					onValueChange={(value) => {
						if (value !== null) {
							onLayoutChange(value);
						}
					}}
				>
					{/* A ghost button like the timeline's speed, so it doesn't compete with the fields below */}
					<SelectPrimitive.Trigger
						aria-label={`Edit ${tunable.label} as`}
						render={
							<Button variant="ghost" size="xs" className="shrink-0 font-sans font-normal text-muted-foreground" />
						}
					>
						<SelectValue />
						<ChevronsUpDownIcon />
					</SelectPrimitive.Trigger>
					<SelectPopup>
						{arrayLayouts.map(({ id, label }) => (
							<SelectItem key={id} value={id}>
								{label}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>
			</SectionHeading>
			{rows.map((start, row) => (
				<div key={start} className={cn('group/row flex', rowClassName)}>
					<span className="flex-1 font-mono text-xs text-muted-foreground tabular-nums">{row}</span>
					{texts.slice(start, start + size).map((text, offset) => {
						const index = start + offset;
						return (
							<div key={index} className="w-30 min-w-0 shrink">
								<ValueField
									tunable={tunable}
									editing={editing}
									label={`${tunable.label} ${index}`}
									text={text}
									value={values[index]}
									changed={values[index] !== applied[index]}
									onFocused={index === added ? () => setAdded(undefined) : undefined}
									placeholder={formatTunableValue(defaults[index])}
									onTextChange={(next) => edit(texts.with(index, next))}
								/>
							</div>
						);
					})}
					{/* Shown while the row is hovered or in use, and always without hover, like the pane controls */}
					<span className="flex w-15 shrink-0 justify-center transition-opacity duration-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:hover)]:opacity-0">
						{tunable.mutable && (
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label={`Remove ${layout?.id === 'list' ? 'value' : 'row'} ${row}`}
								onClick={() => edit(texts.toSpliced(start, size))}
							>
								<XIcon />
							</Button>
						)}
					</span>
				</div>
			))}
			{tunable.mutable && (
				<div className="flex justify-end px-1.5 pe-17 pt-1">
					<Button
						variant="ghost"
						size="xs"
						onClick={() => {
							// Numbers start empty so they're typed in, which a valid default would skip
							const blank = tunable.scalarType === 'boolean' ? 'false' : '';
							setAdded(texts.length);
							edit([...texts, ...Array.from({ length: size }, () => blank)]);
						}}
					>
						<PlusIcon />
						{addLabels[layout?.id ?? 'list']}
					</Button>
				</div>
			)}
		</section>
	);
}
