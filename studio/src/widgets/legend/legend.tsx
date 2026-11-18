import { ChevronDownIcon } from 'lucide-react';
import { type PointerEvent, type ReactNode, use, useEffect, useRef, useState } from 'react';
import { EntryName } from '@/entries/entry-name';
import { MarqueeText } from '@/components/marquee-text';
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu';
import { useBindingDrag, WidgetBindingsContext } from '@/entries/drag';
import { cn } from '@/lib/utils';
import { type Connection, type ConnectionDrag, connectionBetween, rowHeight } from '@/widgets/legend/connections';
import { ConnectionGutter } from '@/widgets/legend/connection-gutter';
import { LegendSwatch } from '@/widgets/legend/swatch';
import type { WidgetBinding } from '@/widgets/widget-type';

export type LegendItem = {
	binding: WidgetBinding;
	/** Swatch color, ignored when there's an `icon` */
	color?: string;
	icon?: ReactNode;
	/** Shown dimmed after the name */
	note?: string;
	/** Has no value at the cursor */
	dimmed: boolean;
	error?: string;
	/** Names to tell the item's name apart from, shortening the rest of it, see `EntryName` */
	distinctFrom?: readonly string[];
};

/**
 * Names each binding of a drawn widget with its color, in wrapping rows or with one `vertical` item per row. Vertical
 * legends of bindings that can be connected get a handle on each row to drag connections between them.
 */
export function Legend({
	items,
	vertical = false,
	dropRole,
	roles = true,
	className,
}: {
	items: LegendItem[];
	vertical?: boolean;
	/** The role entries dropped on the legend's items take, ex. the graph axis the legend is for */
	dropRole?: string;
	/** Shows each item's role, which can be picked there. Roles can also be picked from the item's context menu. */
	roles?: boolean;
	className?: string;
}) {
	const widget = use(WidgetBindingsContext);
	const list = useRef<HTMLUListElement>(null);
	const gutter = useRef<HTMLDivElement>(null);
	const [hovered, setHovered] = useState<Connection>();
	/** The connection being dragged out of a handle, `over` is the binding it would connect to if dropped */
	const [drag, setDrag] = useState<ConnectionDrag & { from: WidgetBinding; over: Connection | undefined }>();

	const connectable = vertical && items.some((item) => item.binding.connects !== undefined);
	const bindings = new Map(items.map((item) => [item.binding.id, item.binding]));
	const colors = new Map(items.map((item) => [item.binding.id, item.color]));
	const rowOf = (id: string) => items.findIndex((item) => item.binding.id === id);
	const connections: Connection[] = items.flatMap((item) =>
		item.binding.sources.map((source) => ({ sourceId: source.id, targetId: item.binding.id, color: item.color })),
	);

	/** Where a dragged connection would go if dropped at the pointer */
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
			sourceId: connection?.source.id ?? from.id,
			toRow: connection && rowOf(to.id),
			color: connection && colors.get(connection.target.id),
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
			className={cn('flex text-sm', vertical ? 'min-w-0 flex-1 flex-col' : 'flex-wrap gap-x-3 gap-y-1', className)}
		>
			{items.map((item) => (
				<LegendEntry
					key={item.binding.id}
					item={item}
					vertical={vertical}
					dropRole={dropRole}
					roles={roles}
					handle={
						connectable && item.binding.connects !== undefined ? (
							// Grabbed anywhere in the row's height, around the small dot it shows
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
								{/* Filled with the color of the connection being hovered or dragged, at both of its ends */}
								<span
									className={cn(
										'size-3 rounded-full border-2 border-muted-foreground/40 transition-colors group-hover/legend-entry:border-foreground',
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
			<div ref={gutter} className="flex">
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
	handle,
}: {
	item: LegendItem;
	vertical: boolean;
	dropRole: string | undefined;
	roles: boolean;
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
				'group/legend-entry flex min-w-0 items-center gap-1.5 select-none',
				item.dimmed && !binding.hidden && 'opacity-50',
			)}
			// Rows are the same height, so connections can be drawn between them
			style={vertical ? { height: rowHeight } : undefined}
			// Right-clicking the item offers to remove its binding, middle-clicking removes it
			data-binding-id={binding.id}
		>
			<LegendSwatch item={item} />
			{/* Dragged by the name to reorder it, so its handle can be dragged to connect it */}
			<span
				ref={handleRef}
				className={cn('min-w-0 cursor-grab py-0.5 font-mono', binding.hidden && 'text-muted-foreground')}
			>
				<LegendName name={binding.name} distinctFrom={item.distinctFrom} />
			</span>
			{/* Rows of a vertical legend line up their roles and handles on the right */}
			{vertical && <span className="flex-1" />}
			{roles && binding.roleLabel !== undefined && (
				<RoleLabel binding={binding} onPick={(role) => widget?.setRole(binding.id, role)} />
			)}
			{item.note !== undefined && <span className="text-muted-foreground">{item.note}</span>}
			{item.error !== undefined && <span className="text-destructive-foreground">{item.error}</span>}
			{handle}
		</li>
	);
}

/** The entry's name, which collapses its first segment after common prefixes when it doesn't fit, and scrolls on hover when it still doesn't */
function LegendName({ name, distinctFrom }: { name: string; distinctFrom: readonly string[] | undefined }) {
	const full = useRef<HTMLSpanElement>(null);
	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		const element = full.current!;
		const observer = new ResizeObserver(() => setCollapsed(element.scrollWidth > element.clientWidth));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<span className="grid grid-cols-[minmax(0,auto)]">
			{/* Never shown, so the legend stays as wide as the full name, and it's expanded again once there's room */}
			<span ref={full} className="invisible h-0 overflow-hidden whitespace-nowrap [grid-area:1/1]">
				<EntryName name={name} distinctFrom={distinctFrom} />
			</span>
			<MarqueeText className="[grid-area:1/1]">
				<EntryName name={name} collapsed={collapsed} distinctFrom={distinctFrom} />
			</MarqueeText>
		</span>
	);
}

/** The binding's role, as wide as the entry's widest role so picking another doesn't resize the legend and move the field beside it */
function RoleLabel({ binding, onPick }: { binding: WidgetBinding; onPick: (role: string) => void }) {
	return (
		<span className="grid shrink-0 text-muted-foreground">
			{binding.roles.length > 1 &&
				binding.roles.map((role) => (
					<span key={role.id} aria-hidden className="invisible flex items-center gap-0.5 [grid-area:1/1]">
						{role.label}
						<span className="size-3" />
					</span>
				))}
			<span className="flex justify-self-end [grid-area:1/1]">
				{binding.roles.length > 1 ? <RolePicker binding={binding} onPick={onPick} /> : binding.roleLabel}
			</span>
		</span>
	);
}

/** The binding's role, which opens a menu of the entry's roles */
function RolePicker({ binding, onPick }: { binding: WidgetBinding; onPick: (role: string) => void }) {
	return (
		<Menu>
			<MenuTrigger
				className="-mx-1 flex shrink-0 cursor-pointer items-center gap-0.5 rounded-sm px-1 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-accent-foreground"
				aria-label={`Draw ${binding.name} as`}
			>
				{binding.roleLabel}
				<ChevronDownIcon className="size-3" />
			</MenuTrigger>
			{/* Focus only goes back to the role after using the keyboard, so Space plays or pauses after picking one with the mouse */}
			<MenuPopup align="start" finalFocus={(closeType) => closeType === 'keyboard'}>
				<MenuRadioGroup value={binding.role?.id} onValueChange={(role: string) => onPick(role)}>
					{binding.roles.map((role) => (
						<MenuRadioItem key={role.id} value={role.id} closeOnClick>
							{role.label}
						</MenuRadioItem>
					))}
				</MenuRadioGroup>
			</MenuPopup>
		</Menu>
	);
}
