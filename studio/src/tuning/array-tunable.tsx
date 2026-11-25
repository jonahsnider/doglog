import { Button } from '@astryxdesign/core/Button';
import { DropdownMenu, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@astryxdesign/core/DropdownMenu';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { fontWeightVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import ChevronsUpDownIcon from 'lucide-react/icons/chevrons-up-down';
import PlusIcon from 'lucide-react/icons/plus';
import XIcon from 'lucide-react/icons/x';
import { useState } from 'react';
import { arrayRowMarker } from './markers.stylex';
import { type Editing, Notes, SectionHeading, ValueField } from '@/tuning/tunable-rows';
import { tunableStyles } from '@/tuning/tunable-styles';
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

const styles = stylex.create({
	notes: { fontWeight: fontWeightVars['--font-weight-normal'] },
	row: { display: 'flex' },
	index: { flex: 1 },
	field: { flexShrink: 1, width: '7.5rem', minWidth: 0 },
	// Shown while the row is hovered or in use, and always without hover, like the pane controls
	remove: {
		display: 'flex',
		flexShrink: 0,
		justifyContent: 'center',
		width: '3.75rem',
		opacity: {
			default: null,
			'@media (hover: hover)': {
				default: 0,
				[stylex.when.ancestor(':hover', arrayRowMarker)]: 1,
				[stylex.when.ancestor(':focus-within', arrayRowMarker)]: 1,
			},
		},
		transition: 'opacity 100ms var(--ease-in-out)',
	},
	add: {
		display: 'flex',
		justifyContent: 'flex-end',
		paddingInlineStart: spacingVars['--spacing-1-5'],
		paddingInlineEnd: '4.25rem',
		paddingTop: spacingVars['--spacing-1'],
	},
});

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
					xstyle={[tunableStyles.code, tunableStyles.truncate, styles.notes]}
					notes={[
						texts.length % size !== 0 && {
							text: `${texts.length} values aren't whole ${layout?.label.toLowerCase()}`,
						},
						editing.stale.has(name) && { text: 'changed since staged', warning: true },
						name in previous && { text: `was ${formatTunableValue(previous[name], { rounded: true })}` },
					]}
				/>
				<DropdownMenu
					// A ghost button like the timeline's speed, so it doesn't compete with the fields below
					button={{
						label: `Edit ${tunable.label} as`,
						variant: 'ghost',
						size: 'sm',
						endContent: <Icon icon={ChevronsUpDownIcon} size="sm" />,
						children: (layout ?? arrayLayouts[0]).label,
					}}
					hasChevron={false}
					alignment="end"
				>
					<DropdownMenuRadioGroup
						label={`Edit ${tunable.label} as`}
						value={layout?.id ?? arrayLayouts[0].id}
						onChange={onLayoutChange}
					>
						{arrayLayouts.map(({ id, label }) => (
							<DropdownMenuRadioItem key={id} value={id} label={label} />
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenu>
			</SectionHeading>
			{rows.map((start, row) => (
				<div key={start} {...stylex.props(arrayRowMarker, tunableStyles.row, styles.row)}>
					<span {...stylex.props(tunableStyles.code, styles.index)}>{row}</span>
					{texts.slice(start, start + size).map((text, offset) => {
						const index = start + offset;
						return (
							<div key={index} {...stylex.props(styles.field)}>
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
					<span {...stylex.props(styles.remove)}>
						{tunable.mutable && (
							<IconButton
								label={`Remove ${layout?.id === 'list' ? 'value' : 'row'} ${row}`}
								icon={<XIcon />}
								variant="ghost"
								size="sm"
								onClick={() => edit(texts.toSpliced(start, size))}
							/>
						)}
					</span>
				</div>
			))}
			{tunable.mutable && (
				<div {...stylex.props(styles.add)}>
					<Button
						label={addLabels[layout?.id ?? 'list']!}
						icon={<PlusIcon />}
						variant="ghost"
						size="sm"
						onClick={() => {
							// Numbers start empty so they're typed in, which a valid default would skip
							const blank = tunable.scalarType === 'boolean' ? 'false' : '';
							setAdded(texts.length);
							edit([...texts, ...Array.from({ length: size }, () => blank)]);
						}}
					/>
				</div>
			)}
		</section>
	);
}
