import { LayoutDashboardIcon, UserIcon, UsersIcon } from 'lucide-react';
import { m, useIsPresent } from 'motion/react';
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
	const isPresent = useIsPresent();
	return (
		// A motion component so the dashboards' `AnimatePresence` removes it right away instead of waiting for an exit animation.
		// Hidden while it's removed, so a dashboard dropped in its spot doesn't push the ones below down for a frame.
		<MotionSidebarMenuItem
			ref={ref}
			className={cn(!isPresent && 'hidden')}
			exit={{ opacity: 0 }}
			transition={{ duration: 0 }}
		>
			<div
				className={cn(
					'flex h-8 items-center gap-2 overflow-hidden rounded-md border border-dashed px-2 text-sm whitespace-nowrap [&>svg]:size-4 [&>svg]:shrink-0',
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
