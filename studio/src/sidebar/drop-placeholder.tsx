import { LayoutDashboardIcon, UserIcon, UsersIcon } from 'lucide-react';
import { m } from 'motion/react';
import type { Ref } from 'react';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { DraggedKind } from '@/sidebar/drag';

const MotionSidebarMenuItem = m.create(SidebarMenuItem);

function content(dragged: DraggedKind, shared: boolean) {
	if (dragged === 'pane') {
		return { Icon: LayoutDashboardIcon, label: shared ? 'Move to new shared dashboard' : 'Move to new dashboard' };
	}
	return shared ? { Icon: UsersIcon, label: 'Share dashboard' } : { Icon: UserIcon, label: 'Stop sharing dashboard' };
}

/**
 * Where a pane or dashboard dropped on one of the sidebar's sections will go, or with `active` off, a hint that it can be
 * dropped there
 */
export function DropPlaceholder({
	ref,
	dragged,
	shared,
	active,
}: {
	ref?: Ref<HTMLLIElement>;
	dragged: DraggedKind;
	shared: boolean;
	active: boolean;
}) {
	const { Icon, label } = content(dragged, shared);
	return (
		// A motion component so the dashboards' `AnimatePresence` removes it right away instead of waiting for an exit animation
		<MotionSidebarMenuItem ref={ref} exit={{ opacity: 0 }} transition={{ duration: 0 }}>
			<div
				className={cn(
					'flex h-8 items-center gap-2 overflow-hidden rounded-md border border-dashed px-2 text-sm whitespace-nowrap select-none [&>svg]:size-4 [&>svg]:shrink-0',
					active
						? 'border-sidebar-primary bg-sidebar-primary/10 text-sidebar-primary'
						: 'border-sidebar-foreground/30 text-sidebar-foreground/70',
				)}
			>
				<Icon />
				<span>{label}</span>
			</div>
		</MotionSidebarMenuItem>
	);
}
