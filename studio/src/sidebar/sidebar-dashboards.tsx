import { useRouter } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion } from 'motion/react';
import { TextMorph } from 'torph/react';
import { type MouseEvent, type ReactNode, useRef } from 'react';
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { TooltipLabel } from '@/components/tooltip-label';
import { DropPlaceholder } from '@/sidebar/drop-placeholder';
import { newDashboard, shortcuts } from '@/commands/commands';
import { type Dashboard, deleteDashboards, useDashboards } from '@/dashboards/dashboards';
import { DashboardItem } from '@/sidebar/dashboard-item';
import { useDragging, useNewDashboardDrop } from '@/sidebar/drag';
import { type DashboardSelection, useDashboardSelection } from '@/sidebar/selection';
import { cn } from '@/lib/utils';
import { simulatorHost } from '@/robot-target';
import { useSettings } from '@/settings';
import { useRecentlyConnected, useSharingHost } from '@/sharing/sharing';
import { type LiveSource, useSources } from '@/data/source';

function isEmptySpace(event: MouseEvent): boolean {
	return event.target instanceof Element && !event.target.closest('[data-sidebar="menu-item"]');
}

export function SidebarDashboards() {
	const router = useRouter();
	const dashboards = useDashboards();
	const selection = useDashboardSelection(dashboards);
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

function useSectionItems({ dashboards, selection }: SectionProps, shared: boolean) {
	const listRef = useRef<HTMLUListElement>(null);
	const placeholderRef = useRef<HTMLLIElement>(null);
	// Panes dropped anywhere on the section move to a new dashboard, dashboards from the other section move here
	const { ref, dropIndex, dragged, dropped } = useNewDashboardDrop(listRef, placeholderRef, shared);
	const section = dashboards.filter((dashboard) => dashboard.shared === shared);
	const items = section.map((dashboard, sectionIndex) => (
		<DashboardItem
			key={dashboard.id}
			dashboard={dashboard}
			dashboards={dashboards}
			index={dashboards.indexOf(dashboard)}
			sectionIndex={sectionIndex}
			selection={selection}
			// Dashboards dropped here show up in full in the placeholder's spot
			appear={!dropped}
		/>
	));
	if (dragged && dropIndex !== undefined) {
		items.splice(
			dropIndex,
			0,
			<DropPlaceholder key="drop-placeholder" ref={placeholderRef} dragged={dragged} shared={shared} active />,
		);
	} else if (dragged && shared && section.length === 0) {
		items.push(<DropPlaceholder key="drop-placeholder" dragged={dragged} shared={shared} active={false} />);
	}
	return { ref, listRef, items };
}

function sharingStatus(
	host: string | undefined,
	recentlyConnected: boolean,
	live: LiveSource | undefined,
	robotTarget: string,
): string | undefined {
	if (host === undefined) {
		return recentlyConnected ? 'Disconnected' : undefined;
	}
	// The data source above already shows where it's connected
	if (live?.host === host) {
		return 'Synced';
	}
	return host === simulatorHost ? 'Synced with simulator' : `Synced with ${robotTarget.trim()}`;
}

/** A muted label starting a section. The collapsed sidebar hides its text but keeps its space, so nothing moves. */
function SectionLabel({ label, children }: { label: string; children?: ReactNode }) {
	return (
		<div className="group/label my-1 flex h-8 items-center px-2 text-xs text-muted-foreground">
			<span className="me-2 font-medium group-data-[collapsible=icon]:hidden">{label}</span>
			{children}
		</div>
	);
}

/** Below the other dashboards, it fills the empty space below it, so the pointer stays in this section when the other's drop placeholder moves it down */
function SharedDashboards(props: SectionProps) {
	const { ref, listRef, items } = useSectionItems(props, true);
	const dragging = useDragging();
	const host = useSharingHost();
	const recentlyConnected = useRecentlyConnected();
	const { robotTarget } = useSettings();
	const { live } = useSources();
	const status = sharingStatus(host, recentlyConnected, live, robotTarget);

	return (
		<SidebarGroup
			ref={ref}
			// Pulled into the gap between the groups, so its row is spaced like the dashboards around it
			className="-mt-2 flex-1 pt-0"
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
		>
			<SectionLabel label="Shared">
				{/* `TextMorph` doesn't animate to or from no text, so the status grows out of nothing. Only "Disconnected" is ever hidden. */}
				{/* It's remounted when shown, so it doesn't morph from the hidden "Disconnected", and numbers are off so addresses aren't morphed like decimals */}
				<span
					aria-hidden={status === undefined}
					className={cn(
						'ms-auto grid min-w-0 transition-[grid-template-columns,opacity] duration-200 ease-in-out motion-reduce:transition-none group-data-[collapsible=icon]:hidden',
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
			</SectionLabel>
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
			<SectionLabel label="Dashboards">
				{props.dashboards.length > 0 && (
					<button
						type="button"
						className="-me-1.5 ms-auto rounded-md px-1.5 whitespace-nowrap text-sidebar-foreground/70 opacity-0 outline-hidden ring-sidebar-ring group-hover/label:opacity-100 group-data-[collapsible=icon]:hidden hover:text-sidebar-foreground focus-visible:opacity-100 focus-visible:ring-2"
						onClick={() => deleteDashboards(props.dashboards.map((dashboard) => dashboard.id))}
					>
						Close all
					</button>
				)}
			</SectionLabel>
			{/* Tooltips and previews would open on the dashboards the pointer passes over */}
			<SidebarMenu ref={listRef} className={cn(dragging && 'pointer-events-none')}>
				<SidebarMenuItem>
					<SidebarMenuButton
						className="text-sidebar-foreground/70 hover:text-sidebar-foreground/70 active:text-sidebar-foreground/70"
						tooltip={{ children: <TooltipLabel label="New dashboard" shortcut={shortcuts.newDashboard} /> }}
						onClick={() => newDashboard(router)}
					>
						<PlusIcon />
						<span>New dashboard</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
				<LazyMotion features={domAnimation} strict>
					<AnimatePresence initial={false}>{items}</AnimatePresence>
				</LazyMotion>
			</SidebarMenu>
		</SidebarGroup>
	);
}
