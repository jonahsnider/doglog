import { colorVars, typeScaleVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import BanIcon from 'lucide-react/icons/ban';
import { Fragment } from 'react';
import { type Entry, getStructSchemas, useDataVersion } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { embeddedLogFormat, readableEmbeddedLogFormats } from '@/data/samples';
import { formatStructPreview } from '@/entries/struct-preview';
import { useCursorTime } from '@/timeline/timeline';

const styles = stylex.create({
	value: {
		flexShrink: 1,
		minWidth: 0,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		textAlign: 'right',
		fontFamily: typographyVars['--font-family-code'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		fontVariantNumeric: 'tabular-nums',
		maxWidth: '7rem',
	},
	preview: {
		maxWidth: '66.666667%',
	},
	muted: {
		color: colorVars['--color-text-secondary'],
	},
	unsupported: {
		flexShrink: 0,
		width: 14,
		height: 14,
		color: colorVars['--color-icon-secondary'],
	},
});

/** Characters that fit in the value's max width of 7rem, IBM Plex Mono is 0.6em wide per character at 12px */
const maxValueLength = 15;

function EntryValue({ entry, field }: { entry: Entry; field: Entry | undefined }) {
	const time = useCursorTime();
	// Values at the cursor can change as samples arrive, ex. while a log loads
	useDataVersion();
	const preview = time === undefined ? undefined : formatStructPreview(entry, time, getStructSchemas());
	const value = time === undefined || preview !== undefined ? undefined : (field ?? entry).samples.valueAt(time);
	const text = formatValue(value);
	// A truncated array says little, and its elements are listed under it
	const count = Array.isArray(value) && text.length > maxValueLength;

	return (
		<span {...stylex.props(styles.value, preview !== undefined && styles.preview, count && styles.muted)}>
			{preview?.map(({ label, value: formatted }, index) => (
				<Fragment key={label}>
					{index > 0 ? ' ' : ''}
					<span {...stylex.props(styles.muted)}>{label}=</span>
					{formatted}
				</Fragment>
			)) ?? (count ? `${value.length} ${value.length === 1 ? 'item' : 'items'}` : text)}
		</span>
	);
}

const unsupportedLabel = "Unsupported type, can't be shown in widgets";

/**
 * An entry's value at the cursor, or a mark for entries of unsupported types. Embedded logs Studio reads have no mark,
 * their entries are listed under them.
 */
export function EntryRowValue({ entry, field }: { entry: Entry; field: Entry | undefined }) {
	const shown = field ?? entry;
	if (shown.kind !== 'unsupported') {
		return <EntryValue entry={entry} field={field} />;
	}
	const format = embeddedLogFormat(shown.type);
	if (format !== undefined && readableEmbeddedLogFormats.has(format)) {
		return null;
	}
	const label =
		format === undefined ? unsupportedLabel : `Studio can't read .${format} logs yet, export it to open it elsewhere`;
	return (
		<Tooltip content={label}>
			<BanIcon role="img" {...stylex.props(styles.unsupported)} aria-label={label} />
		</Tooltip>
	);
}
