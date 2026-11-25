import { colorVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useParams, useRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import PlusIcon from 'lucide-react/icons/plus';
import { AnimatePresence, domAnimation, LazyMotion } from 'motion/react';
import { type MouseEvent, type SyntheticEvent, useRef } from 'react';
import { AppActionMenu, AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { TextMorph } from '@/components/text-morph';
import { TooltipLabel } from '@/components/tooltip-label';
import { DropPlaceholder } from '@/sidebar/drop-placeholder';
import { SectionLabel } from '@/sidebar/section-label';
import { newDashboard, reopenDashboard, shortcuts } from '@/commands/commands';
import { closedStore, type Dashboard, deleteDashboards, useDashboards } from '@/dashboards/dashboards';
import { DashboardItem } from '@/sidebar/dashboard-item';
import { useDragging, useNewDashboardDrop } from '@/sidebar/drag';
import { type DashboardSelection, useDashboardSelection } from '@/sidebar/selection';
import { simulatorHost } from '@/robot-target';
import { useSettings } from '@/settings';
import { useRecentlyConnected, useSharingHost } from '@/sharing/sharing';
import { type LiveSource, useSources } from '@/data/source';
import { useSidebar } from '@/sidebar/sidebar-context';
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/sidebar/sidebar-ui';

const styles = stylex.create({
	// Fills the rest of the sidebar, so right-clicking anywhere under the dashboards opens their menu
	sections: {
		display: 'flex',
		flex: 1,
		flexDirection: 'column',
		gap: spacingVars['--spacing-2'],
	},
	// Pulled into the gap between the groups, so its row is spaced like the dashboards around it
	shared: {
		flex: 1,
		marginTop: `calc(${spacingVars['--spacing-2']} * -1)`,
		paddingTop: 0,
	},
	local: {
		paddingBottom: 0,
	},
	// `TextMorph` doesn't animate to or from no text, so the status grows out of nothing
	status: {
		display: 'grid',
		gridTemplateColumns: '1fr',
		minWidth: 0,
		marginInlineStart: 'auto',
		transitionDuration: { default: '200ms', '@media (prefers-reduced-motion: reduce)': '0s' },
		transitionProperty: 'grid-template-columns, opacity',
		transitionTimingFunction: 'ease-in-out',
	},
	statusHidden: {
		gridTemplateColumns: '0fr',
		opacity: 0,
	},
	statusClip: {
		minWidth: 0,
		overflow: 'hidden',
	},
	statusText: {
		marginInlineStart: spacingVars['--spacing-2'],
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
	dragging: {
		pointerEvents: 'none',
	},
	newDashboard: {
		color: colorVars['--color-text-secondary'],
	},
});

function isEmptySpace(target: EventTarget): boolean {
	return target instanceof Element && !target.closest('[data-sidebar="menu-item"]');
}

function stopPropagation(event: SyntheticEvent): void {
	event.stopPropagation();
}

function preserveRowMenu(event: SyntheticEvent<HTMLElement>): void {
	// Rows normally handle their own menu. When renaming, also keep the section trigger from replacing the browser's menu.
	if (
		!(event.target instanceof Element) ||
		!event.currentTarget.contains(event.target) ||
		!isEmptySpace(event.target)
	) {
		event.stopPropagation();
	}
}

export function SidebarDashboards() {
	const router = useRouter();
	const dashboards = useDashboards();
	const selection = useDashboardSelection(dashboards);
	const { dashboardId } = useParams({ strict: false });
	const { open, isMobile, toggleSidebar } = useSidebar();
	const canReopen = useSelector(closedStore, (groups) => groups.length > 0);
	const local = dashboards.filter((dashboard) => !dashboard.shared);
	const others = local.filter((dashboard) => dashboard.id !== dashboardId);
	const menuItems: MenuEntry[] = [
		{ label: 'New dashboard', shortcut: shortcuts.newDashboard, onSelect: () => newDashboard(router) },
		{
			label: 'Reopen closed dashboard',
			shortcut: shortcuts.reopenDashboard,
			disabled: !canReopen,
			onSelect: () => reopenDashboard(router),
		},
		'separator',
		{
			label: isMobile ? 'Hide sidebar' : open ? 'Collapse sidebar' : 'Expand sidebar',
			shortcut: shortcuts.toggleSidebar,
			onSelect: toggleSidebar,
		},
		'separator',
		{
			label: 'Close all',
			disabled: local.length === 0,
			// Keep the open dashboard until it's the last one left, so a second selection closes it too.
			onSelect: () => deleteDashboards((others.length > 0 ? others : local).map((dashboard) => dashboard.id)),
		},
	];
	const props: SectionProps = {
		dashboards,
		selection,
		onClick: (event) => {
			if (isEmptySpace(event.target)) {
				selection.clear();
			}
		},
		onDoubleClick: (event) => {
			if (isEmptySpace(event.target)) {
				newDashboard(router, 'bottom');
			}
		},
	};
	return (
		<AppContextMenu items={menuItems} label="Dashboard section actions" triggerXstyle={styles.sections}>
			{/* Dragged dashboards and panes are dropped by `DragProvider` */}
			<LocalDashboards {...props} menuItems={menuItems} />
			<SharedDashboards {...props} />
		</AppContextMenu>
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
			xstyle={styles.shared}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
			onContextMenu={preserveRowMenu}
			onTouchStart={preserveRowMenu}
		>
			<SectionLabel label="Shared" onContextMenu={stopPropagation} onTouchStart={stopPropagation}>
				{/* `TextMorph` doesn't animate to or from no text, so the status grows out of nothing. Only "Disconnected" is ever hidden. */}
				{/* It's remounted when shown, so it doesn't morph from the hidden "Disconnected", and numbers are off so addresses aren't morphed like decimals */}
				<span
					aria-hidden={status === undefined}
					{...stylex.props(styles.status, status === undefined && styles.statusHidden)}
				>
					<span {...stylex.props(styles.statusClip)}>
						<TextMorph
							key={status === undefined ? 'hidden' : 'shown'}
							as="span"
							numbers={false}
							{...stylex.props(styles.statusText)}
						>
							{status ?? 'Disconnected'}
						</TextMorph>
					</span>
				</span>
			</SectionLabel>
			<SidebarMenu ref={listRef} xstyle={dragging && styles.dragging}>
				<LazyMotion features={domAnimation} strict>
					<AnimatePresence initial={false}>{items}</AnimatePresence>
				</LazyMotion>
			</SidebarMenu>
		</SidebarGroup>
	);
}

function LocalDashboards(props: SectionProps & { menuItems: readonly MenuEntry[] }) {
	const router = useRouter();
	const { ref, listRef, items } = useSectionItems(props, false);
	const dragging = useDragging();

	return (
		<SidebarGroup
			ref={ref}
			xstyle={styles.local}
			onClick={props.onClick}
			onDoubleClick={props.onDoubleClick}
			onContextMenu={preserveRowMenu}
			onTouchStart={preserveRowMenu}
		>
			<SectionLabel label="Dashboards">
				<AppActionMenu
					items={() => props.menuItems}
					label="Dashboard section actions"
					triggerClassName="sidebar-section-action"
				/>
			</SectionLabel>
			{/* Tooltips and previews would open on the dashboards the pointer passes over */}
			<SidebarMenu ref={listRef} xstyle={dragging && styles.dragging}>
				<SidebarMenuItem>
					<SidebarMenuButton
						xstyle={styles.newDashboard}
						tooltip={<TooltipLabel label="New dashboard" shortcut={shortcuts.newDashboard} />}
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
