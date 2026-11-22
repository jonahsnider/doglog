import LayoutDashboardIcon from 'lucide-react/icons/layout-dashboard';
import MoveIcon from 'lucide-react/icons/move';
import { cn } from '@/lib/utils';
import { bindsEntries, type WidgetType } from '@/widgets/widget-type';

/**
 * Panes are dragged by their title, which shows a move icon and a background while hovered or dragged. Empty panes, which have no name, get one too so they can be dragged.
 * Titles of panes that aren't `movable` don't change while hovered.
 * Double-clicking it edits the widget's entries, for widgets that take them.
 */
export function PaneTitle({
	dragRef,
	movable,
	isDragging,
	type,
	name,
	onEdit,
}: {
	dragRef: (element: Element | null) => void;
	movable: boolean;
	isDragging: boolean;
	type: WidgetType | undefined;
	name: string | undefined;
	onEdit: () => void;
}) {
	const Icon = name === undefined ? LayoutDashboardIcon : type?.icon;
	return (
		<span
			ref={dragRef}
			data-dragging={isDragging || undefined}
			onDoubleClick={type && bindsEntries(type) ? onEdit : undefined}
			className={cn(
				'group/title -ms-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium text-muted-foreground outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring',
				movable &&
					'hover:bg-accent hover:text-accent-foreground data-dragging:bg-accent data-dragging:text-accent-foreground',
			)}
		>
			{Icon && (
				<Icon
					className={cn('size-3.5 shrink-0', movable && 'group-hover/title:hidden group-data-dragging/title:hidden')}
				/>
			)}
			{movable && (
				<MoveIcon className="hidden size-3.5 shrink-0 group-hover/title:block group-data-dragging/title:block" />
			)}
			{/* Source Sans 3 is smaller than IBM Plex Sans, so it's a size up, keeping the line height so the header doesn't grow */}
			<span className="truncate font-heading text-sm/4">{name ?? 'Empty pane'}</span>
		</span>
	);
}
