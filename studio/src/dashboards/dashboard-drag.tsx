import { pointerIntersection } from '@dnd-kit/collision';
import { useDragOperation, useDroppable } from '@dnd-kit/react';
import PanelLeftIcon from 'lucide-react/icons/panel-left';
import PanelRightIcon from 'lucide-react/icons/panel-right';
import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react';
import { easing, useMotionTransition } from '@/lib/motion';
import { dashboardDragType, isDashboardDrag, type SplitZoneData } from '@/dashboards/drag';
import { type Dashboard, useDashboards } from '@/dashboards/dashboards';
import { cn } from '@/lib/utils';
import { canJoinLayouts } from '@/panes/layout';

/** Dragging another dashboard over the open one shows zones to add it as a left or right split */
export function DashboardSplitZones({ dashboard }: { dashboard: Dashboard }) {
	const { source } = useDragOperation();
	const draggedId = isDashboardDrag(source) ? source.data.dashboardId : undefined;
	const dragged = useDashboards().find(({ id }) => id === draggedId && id !== dashboard.id);
	const transition = useMotionTransition({ duration: 0.15, ease: easing.out });

	const disabled = dragged !== undefined && !canJoinLayouts([dashboard.layout, dragged.layout]);

	return (
		// Inset past the peeking sidebar's overhang. The collapsed rail already takes up space in the layout.
		<div className="pointer-events-none absolute inset-4 z-50 flex gap-2 group-has-data-peeking/app:left-[calc(1rem+var(--sidebar-width)-var(--sidebar-width-icon))] @container">
			<LazyMotion features={domAnimation} strict>
				<AnimatePresence>
					{dragged &&
						(['left', 'right'] as const).map((side) => (
							<m.div
								key={side}
								className={cn('flex min-w-0 flex-1 items-center @max-[3rem]:hidden', side === 'right' && 'justify-end')}
								initial={{ opacity: 0, x: side === 'left' ? -16 : 16 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: side === 'left' ? -16 : 16 }}
								transition={transition}
							>
								<SplitZone dashboardId={dashboard.id} side={side} disabled={disabled} />
							</m.div>
						))}
				</AnimatePresence>
			</LazyMotion>
		</div>
	);
}

function SplitZone({
	dashboardId,
	side,
	disabled,
}: {
	dashboardId: string;
	side: SplitZoneData['side'];
	disabled: boolean;
}) {
	const { ref, isDropTarget } = useDroppable<SplitZoneData>({
		id: `split-zone-${side}`,
		accept: dashboardDragType,
		data: { kind: 'split-zone', dashboardId, side },
		disabled,
		// The dragged row can overlap a zone while the pointer is still reordering dashboards in the sidebar.
		collisionDetector: pointerIntersection,
		// dnd-kit's `CollisionPriority.Highest`, above the sidebar's dashboards
		collisionPriority: 4,
	});
	const Icon = side === 'left' ? PanelLeftIcon : PanelRightIcon;

	return (
		<div
			ref={ref}
			className={cn(
				'h-[min(20rem,70%)] w-44 min-w-0 rounded-2xl border bg-popover p-2 shadow-lg @max-xs:px-0',
				disabled && 'opacity-50',
			)}
		>
			<div
				className={cn(
					'flex size-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 text-center text-sm font-medium text-muted-foreground transition-colors @max-xs:px-0 @max-xs:wrap-anywhere',
					isDropTarget && 'border-primary bg-primary/10 text-primary',
				)}
			>
				<Icon className="size-5" />
				{disabled ? 'Too many side by side panes' : side === 'left' ? 'Add left split' : 'Add right split'}
			</div>
		</div>
	);
}
