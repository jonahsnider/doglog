import { LayoutDashboardIcon } from 'lucide-react';
import { m } from 'motion/react';
import type { Ref } from 'react';
import { SidebarMenuItem } from '@/components/ui/sidebar';

const MotionSidebarMenuItem = m.create(SidebarMenuItem);

/** Where a pane dropped on the sidebar's dashboards will be added as a new dashboard */
export function NewDashboardPlaceholder({ ref }: { ref: Ref<HTMLLIElement> }) {
	return (
		// A motion component so the dashboards' `AnimatePresence` removes it right away instead of waiting for an exit animation
		<MotionSidebarMenuItem ref={ref} exit={{ opacity: 0 }} transition={{ duration: 0 }}>
			<div className="flex h-8 items-center gap-2 overflow-hidden rounded-md border border-dashed border-sidebar-primary bg-sidebar-primary/10 px-2 text-sm whitespace-nowrap text-sidebar-primary [&>svg]:size-4 [&>svg]:shrink-0">
				<LayoutDashboardIcon />
				<span>Move to new dashboard</span>
			</div>
		</MotionSidebarMenuItem>
	);
}
