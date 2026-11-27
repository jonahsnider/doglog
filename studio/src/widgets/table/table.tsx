import { useVirtualizer } from '@tanstack/react-virtual'; // oxlint-disable studio/no-manual-memo -- React Compiler skips this component, because of `useVirtualizer()` and the `react-hooks/exhaustive-deps` suppression
import { colorVars, spacingVars, textSizeVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDataVersion, useTimeRange } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { formatTime, seek, useCursorTime, useTimeline } from '@/timeline/timeline';
import { ColumnHeader } from '@/widgets/table/column-header';
import { type Column, fieldAt, tableColumns } from '@/widgets/table/columns';
import { countAtOrBefore, mergeTimes } from '@/widgets/table/rows';
import type { WidgetProps } from '@/widgets/widget-type';
import './table.css';

const rowHeight = 24;

const styles = stylex.create({
	root: {
		height: '100%',
		overflow: 'auto',
		fontFamily: typographyVars['--font-family-code'],
		fontSize: textSizeVars['--font-size-sm'],
	},
	grid: { display: 'grid', minWidth: 'min-content' },
	header: {
		position: 'sticky',
		top: 0,
		zIndex: 2,
		backgroundColor: colorVars['--color-background-card'],
		borderBottomWidth: 1,
		borderBottomStyle: 'solid',
		borderBottomColor: colorVars['--color-border'],
	},
	rows: { position: 'relative' },
	row: {
		position: 'absolute',
		insetInline: 0,
		top: 0,
		height: rowHeight,
		alignItems: 'center',
	},
	cell: {
		minWidth: 0,
		overflow: 'hidden',
		paddingInline: spacingVars['--spacing-2'],
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		userSelect: 'text',
	},
	end: { textAlign: 'end', fontVariantNumeric: 'tabular-nums' },
	// Values that didn't change since the row before are dimmed, so changes stand out
	held: { color: colorVars['--color-text-secondary'] },
	// Stays in view while scrolling sideways, and isn't selectable so copying values copies only values
	time: {
		position: 'sticky',
		insetInlineStart: 0,
		zIndex: 1,
		alignSelf: 'stretch',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'flex-end',
		paddingInline: spacingVars['--spacing-2'],
		color: colorVars['--color-text-secondary'],
		fontVariantNumeric: 'tabular-nums',
		userSelect: 'none',
	},
	timeHeader: {
		backgroundColor: colorVars['--color-background-card'],
		gridColumn: 1,
		gridRow: '1 / -1',
		alignItems: 'flex-end',
		paddingBlock: spacingVars['--spacing-1'],
		fontFamily: typographyVars['--font-family-body'],
	},
	empty: {
		padding: spacingVars['--spacing-2'],
		fontFamily: typographyVars['--font-family-body'],
		color: colorVars['--color-text-secondary'],
	},
});

export function TableWidget({ bindings }: WidgetProps) {
	useDataVersion();
	const time = useCursorTime();
	const range = useTimeRange();
	const { seekRevision } = useTimeline();
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

	const toggle = (path: string) =>
		setExpanded((previous) => {
			const next = new Set(previous);
			if (!next.delete(path)) {
				next.add(path);
			}
			return next;
		});

	const { columns, leaves } = tableColumns(bindings, expanded, time);
	const headerRows = Math.max(...columns.map((column) => column.depth)) + 1;

	const sources = useMemo(
		() => bindings.flatMap(({ entry, others }) => (entry ? [entry, ...others.map((other) => other.entry)] : [])),
		[bindings],
	).map(({ samples }) => samples);
	// Samples are mutated in place, so `signature` tells when a column's samples changed and need merging again
	const signature = sources
		.map((samples) => `${samples.length}:${samples.timestamps[0]}:${samples.timestamps[samples.length - 1]}`)
		.join(',');
	// oxlint-disable-next-line react-hooks/exhaustive-deps
	const times = useMemo(() => mergeTimes(sources), [bindings, signature]);
	// The cursor's row, the latest at or before it, -1 before the first row
	const cursorRow = time === undefined ? -1 : countAtOrBefore(times, time) - 1;

	const scrollElement = useRef<HTMLDivElement>(null);
	const rowsElement = useRef<HTMLDivElement>(null);
	// Rows start below the header, which also covers the top of the table while it's scrolled
	const headerHeight = rowsElement.current?.offsetTop ?? 0;
	// react-doctor-disable-next-line react-hooks-js/incompatible-library -- React Compiler skips this component rather than memoizing the mutable virtualizer
	const virtualizer = useVirtualizer({
		count: times.length,
		getScrollElement: () => scrollElement.current,
		estimateSize: () => rowHeight,
		overscan: 10,
		scrollMargin: headerHeight,
		scrollPaddingStart: headerHeight,
		// Start with the cursor's row at the bottom, where it's scrolled to on mount, so the first frame isn't blank
		initialRect: { width: 0, height: window.innerHeight },
		initialOffset: () => Math.max((cursorRow + 1) * rowHeight - window.innerHeight, 0),
	});

	// Moving the cursor brings its row into view, while playback and live data only keep it in view, so the table can be
	// scrolled away from it while they move the cursor
	const shown = useRef({ row: -1, seekRevision: -1 });
	useLayoutEffect(() => {
		const element = scrollElement.current!;
		const previous = shown.current;
		if (previous.row === cursorRow && previous.seekRevision === seekRevision) {
			return;
		}
		const inView = (row: number) =>
			(row + 1) * rowHeight > element.scrollTop &&
			headerHeight + row * rowHeight < element.scrollTop + element.clientHeight;
		const row = Math.max(cursorRow, 0);
		if (previous.seekRevision !== seekRevision) {
			// Centered to show the rows around it, unless it's already in view, ex. the row was clicked
			if (!inView(row)) {
				virtualizer.scrollToIndex(row, { align: 'center' });
			}
		} else if (inView(previous.row)) {
			virtualizer.scrollToIndex(row, { align: 'auto' });
		}
		shown.current = { row: cursorRow, seekRevision };
	});

	// The header and each row are separate grids, so the time column has a fixed width to line up. Value columns share
	// the rest, and scroll sideways once they'd be narrower than 9rem.
	const gridTemplateColumns = `calc(8ch + 2 * ${spacingVars['--spacing-2']}) repeat(${leaves.length}, minmax(9rem, 1fr))`;

	return (
		<div ref={scrollElement} {...stylex.props(styles.root)}>
			<div
				{...stylex.props(styles.grid, styles.header)}
				style={{ gridTemplateColumns, gridTemplateRows: `repeat(${headerRows}, auto)` }}
			>
				<div {...stylex.props(styles.time, styles.timeHeader)}>Time</div>
				{columns.map((column) => (
					<ColumnHeader
						key={column.path}
						column={column}
						headerRows={headerRows}
						expanded={column.expandable && expanded.has(column.path)}
						onToggle={() => toggle(column.path)}
					/>
				))}
			</div>
			{times.length === 0 ? (
				<p {...stylex.props(styles.empty)}>No values</p>
			) : (
				<div ref={rowsElement} {...stylex.props(styles.rows)} style={{ height: virtualizer.getTotalSize() }}>
					{virtualizer.getVirtualItems().map((item) => {
						const rowTime = times[item.index]!;
						// Clicking a row is a pointer shortcut for moving the cursor, which the timeline does from the keyboard
						// oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
						return (
							// react-doctor-disable-next-line react-doctor/no-static-element-interactions
							<div
								key={item.key}
								data-table-row
								data-cursor={item.index === cursorRow || undefined}
								{...stylex.props(styles.grid, styles.row)}
								style={{ gridTemplateColumns, transform: `translateY(${item.start - headerHeight}px)` }}
								onClick={() => {
									// Selecting values shouldn't move the cursor
									if (window.getSelection()?.isCollapsed !== false) {
										seek(rowTime);
									}
								}}
							>
								<span data-table-time {...stylex.props(styles.time)}>
									{formatTime(rowTime, range?.origin ?? 0)}
								</span>
								{leaves.map((column) => (
									<ValueCell key={column.path} column={column} time={rowTime} />
								))}
							</div>
						);
						// oxlint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
					})}
				</div>
			)}
		</div>
	);
}

/** A column's value at a row, dimmed unless the entry logged a different value at that row's time */
function ValueCell({ column: { samples, fields, align }, time }: { column: Column; time: number }) {
	const index = samples?.indexAtOrBefore(time) ?? -1;
	if (!samples || index < 0) {
		return <span {...stylex.props(styles.cell)} />;
	}
	const text = formatValue(fieldAt(samples.value(index), fields));
	const changed =
		samples.timestamps[index] === time &&
		(index === 0 || formatValue(fieldAt(samples.value(index - 1), fields)) !== text);
	return <span {...stylex.props(styles.cell, align === 'end' && styles.end, !changed && styles.held)}>{text}</span>;
}
