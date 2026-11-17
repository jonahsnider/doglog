import { useRouter } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion } from 'motion/react';
import { type MouseEvent, useRef } from 'react';
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { TooltipLabel } from '@/components/tooltip-label';
import { NewDashboardPlaceholder } from '@/sidebar/new-dashboard-placeholder';
import { newDashboard, shortcuts } from '@/commands/commands';
import { type Dashboard, useDashboards } from '@/dashboards/dashboards';
import { DashboardItem } from '@/sidebar/dashboard-item';
import { useDragging, useNewDashboardDrop } from '@/sidebar/drag';
import { type DashboardSelection, useDashboardSelection } from '@/sidebar/selection';
import { cn } from '@/lib/utils';
import { simulatorHost } from '@/robot-target';
import { useSettings } from '@/settings';
import { useSharingHost } from '@/sharing/sharing';

/** Dashboards and the new dashboard button handle their own clicks */
function isEmptySpace(event: MouseEvent): boolean {
	return event.target instanceof Element && !event.target.closest('[data-sidebar="menu-item"]');
}

export function SidebarDashboards() {
	const dashboards = useDashboards();
	const selection = useDashboardSelection(dashboards);
	return (
		<>
			<SharedDashboards dashboards={dashboards} selection={selection} />
			<LocalDashboards dashboards={dashboards} selection={selection} />
		</>
	);
}

type SectionProps = { dashboards: Dashboard[]; selection: DashboardSelection };

/** A section's dashboards, with a placeholder where a dropped pane or dashboard would go */
function useSectionItems({ dashboards, selection }: SectionProps, shared: boolean) {
	const listRef = useRef<HTMLUListElement>(null);
	const placeholderRef = useRef<HTMLLIElement>(null);
	// Panes dropped anywhere on the section move to a new dashboard, dashboards from the other section move here
	const { ref, dropIndex } = useNewDashboardDrop(listRef, placeholderRef, shared);
	const section = dashboards.filter((dashboard) => dashboard.shared === shared);
	const items = section.map((dashboard, sectionIndex) => (
		<DashboardItem
			key={dashboard.id}
			dashboard={dashboard}
			dashboards={dashboards}
			index={dashboards.indexOf(dashboard)}
			sectionIndex={sectionIndex}
			selection={selection}
		/>
	));
	if (dropIndex !== undefined) {
		items.splice(dropIndex, 0, <NewDashboardPlaceholder key="new-dashboard" ref={placeholderRef} />);
	}
	return { ref, listRef, items, empty: items.length === 0 };
}

function SharedDashboards(props: SectionProps) {
	const { ref, listRef, items, empty } = useSectionItems(props, true);
	const dragging = useDragging();
	const host = useSharingHost();
	const { robotTarget } = useSettings();
	const status =
		host === undefined
			? 'Disconnected'
			: host === simulatorHost
				? 'Synced with simulator'
				: `Synced with ${robotTarget.trim()}`;

	return (
		<SidebarGroup ref={ref}>
			<SidebarGroupLabel>
				Shared
				<span className="ms-auto truncate ps-2 font-normal text-muted-foreground">{status}</span>
			</SidebarGroupLabel>
			<SidebarMenu ref={listRef} className={cn(dragging && 'pointer-events-none')}>
				{empty && (
					<li className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
						Drag a dashboard here to share it with everyone connected to the robot
					</li>
				)}
				<LazyMotion features={domAnimation} strict>
					<AnimatePresence initial={false}>{items}</AnimatePresence>
				</LazyMotion>
			</SidebarMenu>
		</SidebarGroup>
	);
}

function LocalDashboards(props: SectionProps) {
	const router = useRouter();
	const { ref, listRef, items } = useSectionItems(props, false);
	const dragging = useDragging();
	const { selection } = props;

	return (
		// Fills the rest of the sidebar so the empty space below the list can be double-clicked
		<SidebarGroup
			ref={ref}
			className="flex-1"
			onClick={(event) => {
				if (isEmptySpace(event)) {
					selection.clear();
				}
			}}
			onDoubleClick={(event) => {
				if (isEmptySpace(event)) {
					newDashboard(router, 'bottom');
				}
			}}
		>
			{/* Dragged dashboards and panes are dropped by `DragProvider` */}
			{/* Tooltips and previews would open on the dashboards the pointer passes over */}
			<SidebarMenu ref={listRef} className={cn(dragging && 'pointer-events-none')}>
				<SidebarMenuItem>
					<SidebarMenuButton
						// Muted to set it apart from the dashboards below it
						className="text-sidebar-foreground/70 hover:text-sidebar-foreground/70 active:text-sidebar-foreground/70"
						tooltip={{ children: <TooltipLabel label="New dashboard" shortcut={shortcuts.newDashboard} /> }}
						onClick={() => newDashboard(router)}
					>
						<PlusIcon />
						<span>New dashboard</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
				{/* Like Dia, opened dashboards slide down out of the new dashboard button and closed ones slide back up */}
				<LazyMotion features={domAnimation} strict>
					<AnimatePresence initial={false}>{items}</AnimatePresence>
				</LazyMotion>
			</SidebarMenu>
		</SidebarGroup>
	);
}
