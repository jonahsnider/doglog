import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { shallow } from '@tanstack/store';
import { memo, type PointerEvent, type ReactNode, use, useRef, useState } from 'react';
import { WidgetBindingsContext } from '@/entries/drag';
import { type Connection, type ConnectionDrag, connectionBetween } from '@/widgets/legend/connections';
import { ConnectionGutter } from '@/widgets/legend/connection-gutter';
import { LegendEntry } from '@/widgets/legend/legend-entry';
import { legendEntryMarker } from './markers.stylex';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	list: {
		display: 'flex',
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: '1.25rem',
	},
	vertical: { minWidth: 0, flex: 1, flexDirection: 'column' },
	wrapping: { flexWrap: 'wrap', columnGap: spacingVars['--spacing-3'], rowGap: spacingVars['--spacing-1'] },
	// As wide as the widest row, so handles stay near the names
	connectable: { display: 'flex', width: 'fit-content', maxWidth: '100%' },
	// Paints above the handles without taking pointer events from their hit areas
	gutter: { pointerEvents: 'none', position: 'relative', display: 'flex' },
	handle: {
		display: 'flex',
		flexShrink: 0,
		marginInlineEnd: -6,
		padding: 6,
		touchAction: 'none',
		cursor: 'crosshair',
	},
	dragging: { cursor: 'grabbing' },
	handleDot: {
		width: spacingVars['--spacing-3'],
		height: spacingVars['--spacing-3'],
		borderWidth: 2,
		borderStyle: 'solid',
		borderColor: {
			default: colorVars['--color-border-emphasized'],
			[stylex.when.ancestor(':hover', legendEntryMarker)]: colorVars['--color-text-primary'],
		},
		borderRadius: radiusVars['--radius-full'],
		transitionProperty: 'color, background-color, border-color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	draggedDot: { borderColor: colorVars['--color-text-primary'] },
});

export type LegendItem = {
	binding: WidgetBinding;
	/** Swatch color, ignored when there's an `icon` */
	color?: string;
	icon?: ReactNode;
	/** Shown dimmed after the name */
	note?: string;
	/** Settings or actions specific to this entry's role */
	controls?: ReactNode;
	/** The robot a robot or ghost is drawn as, picked with its role, ex. on the field in 3D */
	robot?: string;
	/** How the camera follows the binding's robot, picked after its robot, see `FollowPicker` */
	follow?: string;
	/** Has no value at the cursor */
	dimmed: boolean;
	error?: string;
	/** Names to tell the item's name apart from, shortening the rest of it when it doesn't fit, see `EntryName` */
	distinctFrom?: readonly string[];
};

type LegendProps = {
	items: LegendItem[];
	vertical?: boolean;
	/** The role entries dropped on the legend's items take, ex. the graph axis the legend is for */
	dropRole?: string;
	/** Shows each item's role, which can be picked there. Roles can also be picked from the item's context menu. */
	roles?: boolean;
	/** Merged with the list's styles, ex. to size it in a row of legends. Keep it the same object between renders. */
	xstyle?: stylex.StyleXStyles;
};

/**
 * Names each binding of a drawn widget with its color, in wrapping rows or with one `vertical` item per row. Vertical
 * legends of bindings that can be connected get a handle on each row to drag connections between them.
 */
export const Legend = memo(
	LegendList,
	(previous, next) =>
		// Widgets rebuild items at the cursor, but most ticks don't change whether any of them have a value.
		previous.vertical === next.vertical &&
		previous.dropRole === next.dropRole &&
		previous.roles === next.roles &&
		previous.xstyle === next.xstyle &&
		(previous.items === next.items ||
			(previous.items.length === next.items.length &&
				previous.items.every((item, index) => shallow(item, next.items[index])))),
);

function LegendList({ items, vertical = false, dropRole, roles = true, xstyle }: LegendProps) {
	const widget = use(WidgetBindingsContext);
	const list = useRef<HTMLUListElement>(null);
	const gutter = useRef<HTMLDivElement>(null);
	const [hovered, setHovered] = useState<Connection>();
	const [drag, setDrag] = useState<ConnectionDrag & { from: WidgetBinding }>();

	const connectable = vertical && items.some((item) => item.binding.connects !== undefined);
	const followable = items.some((item) => item.follow !== undefined);
	const bindings = new Map(items.map((item) => [item.binding.id, item.binding]));
	const colors = new Map(items.map((item) => [item.binding.id, item.color]));
	const rowOf = (id: string) => items.findIndex((item) => item.binding.id === id);
	const connections: Connection[] = items.flatMap((item) =>
		item.binding.sources.map((source) => ({ sourceId: source.id, targetId: item.binding.id, color: item.color })),
	);

	const dragAt = (from: WidgetBinding, event: PointerEvent) => {
		const rect = gutter.current!.getBoundingClientRect();
		const element = document.elementFromPoint(event.clientX, event.clientY);
		const id =
			element && list.current?.contains(element) === true
				? element.closest<HTMLElement>('[data-binding-id]')?.dataset['bindingId']
				: undefined;
		const to = id === undefined ? undefined : bindings.get(id);
		const connection = to && connectionBetween(from, to);
		return {
			from,
			fromRow: rowOf(from.id),
			toRow: connection && rowOf(to.id),
			x: event.clientX,
			y: event.clientY,
			originX: rect.left,
			originY: rect.top,
			over: connection && {
				sourceId: connection.source.id,
				targetId: connection.target.id,
				color: colors.get(connection.target.id),
			},
		};
	};
	const highlighted = drag?.over ?? hovered;

	const legend = (
		<ul
			ref={list}
			data-binding-legend
			{...stylex.props(styles.list, vertical ? styles.vertical : styles.wrapping, xstyle)}
		>
			{items.map((item) => (
				<LegendEntry
					key={item.binding.id}
					item={item}
					vertical={vertical}
					dropRole={dropRole}
					roles={roles}
					followable={followable}
					handle={
						connectable && item.binding.connects !== undefined ? (
							<span
								{...stylex.props(styles.handle, drag?.from.id === item.binding.id && styles.dragging)}
								title="Drag to another entry to connect them"
								onPointerDown={(event) => {
									event.preventDefault();
									event.currentTarget.setPointerCapture(event.pointerId);
									setDrag(dragAt(item.binding, event));
								}}
								onPointerMove={(event) => drag && setDrag(dragAt(drag.from, event))}
								onPointerUp={(event) => {
									const over = drag && dragAt(drag.from, event).over;
									if (over) {
										widget?.connect(over.sourceId, over.targetId);
									}
									setDrag(undefined);
								}}
								onPointerCancel={() => setDrag(undefined)}
							>
								<span
									{...stylex.props(styles.handleDot, drag?.from.id === item.binding.id && styles.draggedDot)}
									style={
										highlighted?.sourceId === item.binding.id || highlighted?.targetId === item.binding.id
											? { borderColor: highlighted.color, background: highlighted.color }
											: undefined
									}
								/>
							</span>
						) : undefined
					}
				/>
			))}
		</ul>
	);

	if (!connectable) {
		return legend;
	}
	return (
		<div {...stylex.props(styles.connectable)}>
			{legend}
			<div ref={gutter} {...stylex.props(styles.gutter)}>
				<ConnectionGutter
					rows={items.length}
					connections={connections}
					rowOf={rowOf}
					hidden={(id) => bindings.get(id)?.hidden === true}
					hovered={hovered}
					onHover={setHovered}
					onRemove={(connection) => {
						setHovered(undefined);
						widget?.disconnect(connection.sourceId, connection.targetId);
					}}
					drag={drag}
				/>
			</div>
		</div>
	);
}
