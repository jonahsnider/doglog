import { shallow } from '@tanstack/store';
import { memo, type PointerEvent, type ReactNode, use, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { EntryName } from '@/entries/entry-name';
import { MarqueeText } from '@/components/marquee-text';
import { useBindingDrag, WidgetBindingsContext } from '@/entries/drag';
import { cn } from '@/lib/utils';
import { type Connection, type ConnectionDrag, connectionBetween, rowHeight } from '@/widgets/legend/connections';
import { ConnectionGutter } from '@/widgets/legend/connection-gutter';
import { FollowPicker } from '@/widgets/legend/follow-picker';
import { RobotPicker } from '@/widgets/legend/robot-picker';
import { RoleLabel } from '@/widgets/legend/role-picker';
import { LegendSwatch } from '@/widgets/legend/swatch';
import type { WidgetBinding } from '@/widgets/widget-type';

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
	className?: string;
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
		previous.className === next.className &&
		(previous.items === next.items ||
			(previous.items.length === next.items.length &&
				previous.items.every((item, index) => shallow(item, next.items[index])))),
);

function LegendList({ items, vertical = false, dropRole, roles = true, className }: LegendProps) {
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
			className={cn('flex text-sm', vertical ? 'min-w-0 flex-1 flex-col' : 'flex-wrap gap-x-3 gap-y-1', className)}
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
								className={cn(
									'-me-[6px] flex shrink-0 touch-none p-[6px]',
									drag?.from.id === item.binding.id ? 'cursor-grabbing' : 'cursor-crosshair',
								)}
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
									className={cn(
										'size-3 rounded-full border-2 border-outline transition-colors group-hover/legend-entry:border-foreground',
										drag?.from.id === item.binding.id && 'border-foreground',
									)}
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
	// As wide as the widest row, so handles stay near the names
	return (
		<div className="flex w-fit max-w-full">
			{legend}
			{/* Paint above the handles without taking pointer events from their hit areas. */}
			<div ref={gutter} className="pointer-events-none relative flex">
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

function LegendEntry({
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
			className={cn(
				'group/legend-entry flex min-w-0 items-center gap-1.5',
				item.dimmed && !binding.hidden && 'opacity-50',
			)}
			// Rows are the same height, so connections can be drawn between them
			style={vertical ? { height: rowHeight } : undefined}
			// Right-clicking the item offers to remove its binding, middle-clicking removes it
			data-binding-id={binding.id}
			data-robot-model={item.robot}
		>
			<LegendSwatch item={item} />
			{/* Dragged by the name to reorder it, so its handle can be dragged to connect it */}
			<span
				ref={handleRef}
				className={cn('min-w-0 cursor-grab py-0.5 font-mono', binding.hidden && 'text-muted-foreground')}
			>
				<LegendName name={binding.name} distinctFrom={item.distinctFrom} />
			</span>
			{vertical && <span className="flex-1" />}
			{/* Robots pick their role with their robot */}
			{roles && binding.roleLabel !== undefined && item.robot === undefined && (
				<RoleLabel binding={binding} onPick={(role) => widget?.setRole(binding.id, role)} />
			)}
			{item.robot !== undefined && <RobotPicker binding={binding} robot={item.robot} />}
			{item.follow === undefined ? (
				followable && <span className="size-3.5 shrink-0" />
			) : (
				<FollowPicker binding={binding} follow={item.follow} />
			)}
			{item.note !== undefined && <span className="whitespace-nowrap text-muted-foreground">{item.note}</span>}
			{item.controls}
			{item.error !== undefined && <span className="text-destructive-foreground">{item.error}</span>}
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
		<span className="grid grid-cols-[minmax(0,auto)]">
			{/* Never shown, so the legend stays as wide as the full name, and it's expanded again once there's room */}
			<span ref={full} className="invisible h-0 overflow-hidden whitespace-nowrap [grid-area:1/1]">
				<EntryName name={name} />
			</span>
			<MarqueeText className="[grid-area:1/1]">
				<EntryName name={name} collapsed={collapsed} distinctFrom={collapsed ? distinctFrom : undefined} />
			</MarqueeText>
		</span>
	);
}
