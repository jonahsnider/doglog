import { useRouter } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion } from 'motion/react';
import { TextMorph } from 'torph/react';
import { type MouseEvent, useRef } from 'react';
import { Separator } from '@/components/ui/separator';
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { TooltipLabel } from '@/components/tooltip-label';
import { DropPlaceholder } from '@/sidebar/drop-placeholder';
import { newDashboard, shortcuts } from '@/commands/commands';
import { type Dashboard, useDashboards } from '@/dashboards/dashboards';
import { DashboardItem } from '@/sidebar/dashboard-item';
import { useDragging, useNewDashboardDrop } from '@/sidebar/drag';
import { type DashboardSelection, useDashboardSelection } from '@/sidebar/selection';
import { cn } from '@/lib/utils';
import { simulatorHost } from '@/robot-target';
import { useSettings } from '@/settings';
import { useRecentlyConnected, useSharingHost } from '@/sharing/sharing';

/** Dashboards and the new dashboard button handle their own clicks */
function isEmptySpace(event: MouseEvent): boolean {
	return event.target instanceof Element && !event.target.closest('[data-sidebar="menu-item"]');
}

export function SidebarDashboards() {
	const router = useRouter();
	const dashboards = useDashboards();
	const selection = useDashboardSelection(dashboards);
	// Clicking empty space clears the selection, double-clicking it adds a dashboard
	const props: SectionProps = {
		dashboards,
		selection,
		onClick: (event) => {
			if (isEmptySpace(event)) {
				selection.clear();
			}
		},
		onDoubleClick: (event) => {
			if (isEmptySpace(event)) {
				newDashboard(router, 'bottom');
			}
		},
	};
	return (
		<>
			{/* Dragged dashboards and panes are dropped by `DragProvider` */}
			<LocalDashboards {...props} />
			<SharedDashboards {...props} />
		</>
	);
}

type SectionProps = {
	dashboards: Dashboard[];
	selection: DashboardSelection;
	onClick: (event: MouseEvent) => void;
	onDoubleClick: (event: MouseEvent) => void;
};

/** A section's dashboards, with a placeholder where a dropped pane or dashboard would go */
function useSectionItems({ dashboards, selection }: SectionProps, shared: boolean) {
	const listRef = useRef<HTMLUListElement>(null);
	const placeholderRef = useRef<HTMLLIElement>(null);
	// Panes dropped anywhere on the section move to a new dashboard, dashboards from the other section move here
	const { ref, dropIndex, dragged } = useNewDashboardDrop(listRef, placeholderRef, shared);
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
	if (dragged && dropIndex !== undefined) {
		items.splice(
			dropIndex,
			0,
			<DropPlaceholder key="drop-placeholder" ref={placeholderRef} dragged={dragged} shared={shared} active />,
		);
	} else if (dragged && shared && section.length === 0) {
		// Shows that the empty shared section can be dropped on
		items.push(<DropPlaceholder key="drop-placeholder" dragged={dragged} shared={shared} active={false} />);
	}
	return { ref, listRef, items };
}

/**
 * Below the other dashboards, set apart by a line so it doesn't move when the sidebar is collapsed like a group label would.
 * It fills the empty space below it, so the pointer stays in this section when the other's drop placeholder moves it down.
 */
function SharedDashboards(props: SectionProps) {
	const { ref, listRef, items } = useSectionItems(props, true);
	const dragging = useDragging();
	const host = useSharingHost();
	const recentlyConnected = useRecentlyConnected();
	const { robotTarget } = useSettings();
	const status =
		host === undefined
			? recentlyConnected
				? 'Disconnected'
				: undefined
			: host === simulatorHost
				? 'Synced with simulator'
				: `Synced with ${robotTarget.trim()}`;

	return (
		<SidebarGroup
			ref={ref}
			// Pulled into the gap between the groups, so its row is spaced like the dashboards around it
			className="-mt-2 flex-1 pt-0"
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
		>
			<div className="my-1 flex h-8 items-center ps-2 text-xs text-muted-foreground select-none">
				<span className="me-2 font-medium group-data-[collapsible=icon]:hidden">Shared</span>
				<Separator className="flex-1 bg-sidebar-border" />
				{/* `TextMorph` doesn't animate to or from no text, so the status grows out of nothing and the line shrinks with it. Only "Disconnected" is ever hidden. */}
				{/* It's remounted when shown, so it doesn't morph from the hidden "Disconnected", and numbers are off so addresses aren't morphed like decimals */}
				<span
					aria-hidden={status === undefined}
					className={cn(
						'grid min-w-0 transition-[grid-template-columns,opacity] duration-200 ease-in-out motion-reduce:transition-none group-data-[collapsible=icon]:hidden',
						status === undefined ? 'grid-cols-[0fr] opacity-0' : 'grid-cols-[1fr]',
					)}
				>
					<span className="min-w-0 overflow-hidden">
						<TextMorph
							key={status === undefined ? 'hidden' : 'shown'}
							as="span"
							className="ms-2 truncate"
							numbers={false}
						>
							{status ?? 'Disconnected'}
						</TextMorph>
					</span>
				</span>
			</div>
			<SidebarMenu ref={listRef} className={cn(dragging && 'pointer-events-none')}>
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

	return (
		<SidebarGroup ref={ref} className="pb-0" onClick={props.onClick} onDoubleClick={props.onDoubleClick}>
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
