import { useDragOperation, useDroppable } from '@dnd-kit/react';
import { useParams } from '@tanstack/react-router';
import { PanelLeftIcon, PanelRightIcon } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { dashboardDragType, isDashboardDrag, type SplitZoneData } from '@/dashboard-drag';
import { getDashboard, useDashboards } from '@/dashboards';
import { cn } from '@/lib/utils';
import { canJoinLayouts } from '@/pane-layout';

/** Like Dia, dragging another dashboard over the open one shows zones to add it as a left or right split */
export function DashboardSplitZones() {
	const { dashboardId } = useParams({ strict: false });
	const { source } = useDragOperation();
	// Subscribes to dashboard changes, so the zones are disabled as soon as the layouts can't be combined
	useDashboards();
	const draggedId = isDashboardDrag(source) ? String(source.id) : undefined;
	const current = dashboardId === undefined ? undefined : getDashboard(dashboardId);
	const dragged = draggedId === undefined || draggedId === dashboardId ? undefined : getDashboard(draggedId);
	const reducedMotion = useReducedMotion() ?? false;

	const show = current !== undefined && dragged !== undefined;
	const disabled = show && !canJoinLayouts(current.layout, dragged.layout);

	return (
		<LazyMotion features={domAnimation} strict>
			<AnimatePresence>
				{show &&
					(['left', 'right'] as const).map((side) => (
						<m.div
							key={side}
							className={cn(
								'pointer-events-none absolute inset-y-0 z-50 flex items-center p-4',
								side === 'left' ? 'left-0' : 'right-0',
							)}
							initial={{ opacity: 0, x: reducedMotion ? 0 : side === 'left' ? -16 : 16 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: reducedMotion ? 0 : side === 'left' ? -16 : 16 }}
							transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
						>
							<SplitZone dashboardId={current.id} side={side} disabled={disabled} />
						</m.div>
					))}
			</AnimatePresence>
		</LazyMotion>
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
		// dnd-kit's `CollisionPriority.Highest`, above the sidebar's dashboards
		collisionPriority: 4,
	});
	const Icon = side === 'left' ? PanelLeftIcon : PanelRightIcon;

	return (
		<div
			ref={ref}
			className={cn(
				'h-[min(20rem,70%)] w-44 rounded-2xl border bg-background/80 p-2 shadow-lg backdrop-blur-sm transition-colors',
				isDropTarget && 'border-primary/50 bg-primary/10',
				disabled && 'opacity-50',
			)}
		>
			<div
				className={cn(
					'flex size-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 text-center text-sm font-medium text-muted-foreground transition-colors',
					isDropTarget && 'border-primary text-primary',
				)}
			>
				<Icon className="size-5" />
				{disabled ? 'Too many side by side panes' : side === 'left' ? 'Add left split' : 'Add right split'}
			</div>
		</div>
	);
}
