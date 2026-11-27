import { colorVars, spacingVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { type ReactNode, use, useLayoutEffect, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { MarqueeText } from '@/components/marquee-text';
import { useBindingDrag, WidgetBindingsContext } from '@/entries/drag';
import { EntryName } from '@/entries/entry-name';
import { shortenableSegments } from '@/entries/short-names';
import { rowHeight } from '@/widgets/legend/connections';
import { FollowPicker } from '@/widgets/legend/follow-picker';
import type { LegendItem } from '@/widgets/legend/legend';
import { legendEntryMarker } from './markers.stylex';
import { RobotPicker } from '@/widgets/legend/robot-picker';
import { RoleLabel } from '@/widgets/legend/role-picker';
import { LegendSwatch } from '@/widgets/legend/swatch';
import { SourceTags } from '@/widgets/line-sample';

const styles = stylex.create({
	entry: {
		display: 'flex',
		minWidth: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
	},
	dimmed: { opacity: 0.5 },
	// Shrinks first, but only down to its shortest form, or half the row for long ones, see `LegendName`
	name: (shortest: number) => ({
		minWidth: `min(${shortest}px, 50%)`,
		paddingBlock: spacingVars['--spacing-0-5'],
		fontFamily: typographyVars['--font-family-code'],
		cursor: 'grab',
	}),
	secondary: { color: colorVars['--color-text-secondary'] },
	spacer: { flex: 1 },
	// Room for another row's follow button
	followSpace: { flexShrink: 0, width: 14, height: 14 },
	// Shrinks once the name is as short as it gets, scrolling to show the rest while hovered like it
	note: { flexShrink: 0.001, color: colorVars['--color-text-secondary'] },
	error: { color: colorVars['--color-text-error'] },
	nameGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, auto)' },
	// As wide as its text, up to the column, so its width can be measured
	hiddenName: {
		visibility: 'hidden',
		gridArea: '1 / 1',
		justifySelf: 'start',
		maxWidth: '100%',
		height: 0,
		overflow: 'hidden',
		whiteSpace: 'nowrap',
	},
	shownName: { gridArea: '1 / 1' },
});

export function LegendEntry({
	item,
	vertical,
	dropRole,
	roles,
	distinctFrom,
	followable,
	handle,
}: {
	item: LegendItem;
	vertical: boolean;
	dropRole: string | undefined;
	roles: boolean;
	distinctFrom: readonly string[];
	/** Some item can be followed, so the others leave room for its button to keep the pickers in a column */
	followable: boolean;
	/** Dragged to connect the binding to another */
	handle: ReactNode;
}) {
	const { binding } = item;
	const widget = use(WidgetBindingsContext);
	const { ref, handleRef } = useBindingDrag(binding, { orientation: vertical ? 'vertical' : 'horizontal', dropRole });
	return (
		<li
			ref={ref}
			{...stylex.props(legendEntryMarker, styles.entry, item.dimmed && !binding.hidden && styles.dimmed)}
			// Rows are the same height, so connections can be drawn between them
			style={vertical ? { height: rowHeight } : undefined}
			// Right-clicking the item offers to remove its binding, middle-clicking removes it
			data-binding-id={binding.id}
			data-robot-model={item.robot}
		>
			<LegendSwatch item={item} />
			<LegendName
				name={binding.name}
				distinctFrom={distinctFrom}
				handleRef={handleRef}
				xstyle={binding.hidden && styles.secondary}
			/>
			{vertical && <span {...stylex.props(styles.spacer)} />}
			{/* Robots pick their role with their robot */}
			{roles && binding.roleLabel !== undefined && item.robot === undefined && (
				<RoleLabel binding={binding} onPick={(role) => widget?.setRole(binding.id, role)} />
			)}
			{item.robot !== undefined && <RobotPicker binding={binding} robot={item.robot} />}
			{item.follow === undefined ? (
				followable && <span {...stylex.props(styles.followSpace)} />
			) : (
				<FollowPicker binding={binding} follow={item.follow} />
			)}
			<SourceTags item={item} />
			{item.note !== undefined && <MarqueeText xstyle={styles.note}>{item.note}</MarqueeText>}
			{item.controls}
			{item.error !== undefined && <span {...stylex.props(styles.error)}>{item.error}</span>}
			{handle}
		</li>
	);
}

/**
 * The entry's name, which shortens as few of the segments that don't tell it apart from `distinctFrom` as it needs to
 * fit, from the first, and scrolls on hover when it still doesn't
 */
function LegendName({
	name,
	distinctFrom,
	handleRef,
	xstyle,
}: {
	name: string;
	distinctFrom: readonly string[];
	handleRef: (element: Element | null) => void;
	xstyle: stylex.StyleXStyles;
}) {
	const grid = useRef<HTMLSpanElement>(null!);
	const full = useRef<HTMLSpanElement>(null!);
	const shortenedForms = useRef<(HTMLSpanElement | null)[]>([]);
	const [shortened, setShortened] = useState(0);
	const [shortest, setShortest] = useState(0);
	const { length } = shortenableSegments(name, distinctFrom).segments;

	const measure = () => {
		// Can run after it's unmounted, ex. when the field widget switches to 3D
		const room: number | undefined = grid.current?.clientWidth;
		if (room === undefined) {
			return;
		}
		const widths = [full.current, ...shortenedForms.current.slice(0, length)].map((form) => form?.scrollWidth ?? 0);
		const fits = widths.findIndex((width) => width <= room);
		setShortened(fits === -1 ? length : fits);
		setShortest(widths.at(-1) ?? 0);
	};
	useResizeObserver({ ref: grid, onResize: measure });
	// The forms also change without resizing, ex. when another entry is added
	useLayoutEffect(measure);

	return (
		// Dragged by the name to reorder it, so its handle can be dragged to connect it
		<span ref={handleRef} {...stylex.props(styles.name(shortest), xstyle)}>
			<span ref={grid} {...stylex.props(styles.nameGrid)}>
				{/* Never shown, so the legend stays as wide as the full name, and it's expanded again once there's room */}
				<span ref={full} {...stylex.props(styles.hiddenName)}>
					<EntryName name={name} />
				</span>
				{/* Each shortened form, never shown, to pick the longest that fits */}
				{Array.from({ length }, (_, index) => (
					<span
						key={index}
						ref={(element) => {
							shortenedForms.current[index] = element;
						}}
						{...stylex.props(styles.hiddenName)}
					>
						<EntryName name={name} distinctFrom={distinctFrom} shortenedSegments={index + 1} />
					</span>
				))}
				<MarqueeText xstyle={styles.shownName}>
					<EntryName name={name} distinctFrom={distinctFrom} shortenedSegments={shortened} />
				</MarqueeText>
			</span>
		</span>
	);
}
