import { colorVars, spacingVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { type ReactNode, use, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { MarqueeText } from '@/components/marquee-text';
import { useBindingDrag, WidgetBindingsContext } from '@/entries/drag';
import { EntryName } from '@/entries/entry-name';
import { rowHeight } from '@/widgets/legend/connections';
import { FollowPicker } from '@/widgets/legend/follow-picker';
import type { LegendItem } from '@/widgets/legend/legend';
import { legendEntryMarker } from './markers.stylex';
import { RobotPicker } from '@/widgets/legend/robot-picker';
import { RoleLabel } from '@/widgets/legend/role-picker';
import { LegendSwatch } from '@/widgets/legend/swatch';

const styles = stylex.create({
	entry: {
		display: 'flex',
		minWidth: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
	},
	dimmed: { opacity: 0.5 },
	name: {
		minWidth: 0,
		paddingBlock: spacingVars['--spacing-0-5'],
		fontFamily: typographyVars['--font-family-code'],
		cursor: 'grab',
	},
	secondary: { color: colorVars['--color-text-secondary'] },
	spacer: { flex: 1 },
	// Room for another row's follow button
	followSpace: { flexShrink: 0, width: 14, height: 14 },
	note: { whiteSpace: 'nowrap', color: colorVars['--color-text-secondary'] },
	error: { color: colorVars['--color-text-error'] },
	nameGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, auto)' },
	fullName: {
		visibility: 'hidden',
		gridArea: '1 / 1',
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
	followable,
	handle,
}: {
	item: LegendItem;
	vertical: boolean;
	dropRole: string | undefined;
	roles: boolean;
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
			{/* Dragged by the name to reorder it, so its handle can be dragged to connect it */}
			<span ref={handleRef} {...stylex.props(styles.name, binding.hidden && styles.secondary)}>
				<LegendName name={binding.name} distinctFrom={item.distinctFrom} />
			</span>
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
			{item.note !== undefined && <span {...stylex.props(styles.note)}>{item.note}</span>}
			{item.controls}
			{item.error !== undefined && <span {...stylex.props(styles.error)}>{item.error}</span>}
			{handle}
		</li>
	);
}

/**
 * The entry's name, which collapses its first segment after common prefixes when it doesn't fit, or the segments that
 * don't tell it apart from `distinctFrom`, and scrolls on hover when it still doesn't
 */
function LegendName({ name, distinctFrom }: { name: string; distinctFrom: readonly string[] | undefined }) {
	const full = useRef<HTMLSpanElement>(null!);
	const [collapsed, setCollapsed] = useState(false);

	useResizeObserver({
		ref: full,
		onResize: () => {
			// Can run after it's unmounted, ex. when the field widget switches to 3D
			const element: HTMLSpanElement | null = full.current;
			if (element !== null) {
				setCollapsed(element.scrollWidth > element.clientWidth);
			}
		},
	});

	return (
		<span {...stylex.props(styles.nameGrid)}>
			{/* Never shown, so the legend stays as wide as the full name, and it's expanded again once there's room */}
			<span ref={full} {...stylex.props(styles.fullName)}>
				<EntryName name={name} />
			</span>
			<MarqueeText className={stylex.props(styles.shownName).className}>
				<EntryName name={name} collapsed={collapsed} distinctFrom={collapsed ? distinctFrom : undefined} />
			</MarqueeText>
		</span>
	);
}
