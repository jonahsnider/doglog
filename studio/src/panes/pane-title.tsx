import { MoveIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetType } from '@/widgets/widget-type';

/** Like Rex, panes are dragged by their title, which shows a move icon and a background while hovered or dragged */
export function PaneTitle({
	dragRef,
	isDragging,
	icon: Icon,
	name,
}: {
	dragRef: (element: Element | null) => void;
	isDragging: boolean;
	icon: WidgetType['icon'] | undefined;
	name: string | undefined;
}) {
	return (
		<span
			ref={dragRef}
			data-dragging={isDragging || undefined}
			className={cn(
				'group/title -ms-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium text-muted-foreground outline-none select-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring',
				'hover:bg-accent hover:text-accent-foreground data-dragging:bg-accent data-dragging:text-accent-foreground',
			)}
		>
			{Icon && <Icon className="size-3.5 shrink-0 group-hover/title:hidden group-data-dragging/title:hidden" />}
			<MoveIcon className="hidden size-3.5 shrink-0 group-hover/title:block group-data-dragging/title:block" />
			<span className="truncate">{name}</span>
		</span>
	);
}
