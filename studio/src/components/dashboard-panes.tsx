import type { Hotkey } from '@tanstack/react-hotkeys';
import {
	ChevronDownIcon,
	Columns2Icon,
	LayoutGridIcon,
	ReplaceIcon,
	Rows2Icon,
	Settings2Icon,
	XIcon,
} from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { WidgetOptions } from '@/components/entry-picker';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { WidgetView } from '@/components/widget-view';
import { shortcuts } from '@/commands';
import {
	closeDashboardPane,
	type Dashboard,
	focusPane,
	getFocusedPane,
	splitDashboardPane,
	updateLayout,
} from '@/dashboards';
import { getEntry } from '@/data/data-store';
import { cn } from '@/lib/utils';
import {
	canSplitPane,
	type Pane,
	type PaneNode,
	resizeSplit,
	setPaneWidget,
	type Split,
	type SplitDirection,
} from '@/pane-layout';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import { acceptsEntry, type WidgetType, widgetConfigSchema } from '@/widgets/widget-type';

type PaneNodeProps = {
	dashboardId: string;
	dashboardLayout: PaneNode;
	/** Only set when there's more than one pane */
	focusedPaneId: string | undefined;
};

export function DashboardPanes({ dashboard }: { dashboard: Dashboard }) {
	const { layout } = dashboard;
	const focusedPaneId = layout.kind === 'split' ? getFocusedPane(dashboard).id : undefined;
	return (
		<PaneNodeView
			dashboardId={dashboard.id}
			dashboardLayout={layout}
			focusedPaneId={focusedPaneId}
			node={layout}
			root
		/>
	);
}

function PaneNodeView({ node, root = false, ...props }: PaneNodeProps & { node: PaneNode; root?: boolean }) {
	return node.kind === 'pane' ? (
		// Closing the only pane does nothing unless there's a widget to remove
		<PaneView {...props} pane={node} closable={!root || node.widget !== undefined} />
	) : (
		// Keyed so a split that takes another's place reads its own saved ratio
		<SplitView key={node.id} {...props} split={node} />
	);
}

function SplitView({ split, ...props }: PaneNodeProps & { split: Split }) {
	const { dashboardId } = props;
	const row = split.direction === 'row';
	const firstId = `${split.id}-first`;
	const secondId = `${split.id}-second`;

	return (
		<Group
			orientation={row ? 'horizontal' : 'vertical'}
			defaultLayout={{ [firstId]: split.ratio * 100, [secondId]: (1 - split.ratio) * 100 }}
			// Called once a drag is released or a key is pressed, not on every pointer move
			onLayoutChanged={(panelLayout, { isUserInteraction, requestedLayout = panelLayout }) => {
				const size = requestedLayout[firstId];
				if (isUserInteraction && size !== undefined) {
					updateLayout(dashboardId, (layout) => resizeSplit(layout, split.id, size / 100));
				}
			}}
		>
			{/* Keep panes big enough for their controls */}
			<Panel id={firstId} minSize="7rem" style={{ overflow: 'hidden' }}>
				<PaneNodeView {...props} node={split.first} />
			</Panel>
			<Separator
				aria-label="Resize panes"
				// The library makes the hit area wider than the visible line
				className={cn(
					'bg-border outline-none transition-colors focus-visible:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring',
					row ? 'w-px' : 'h-px',
				)}
			/>
			<Panel id={secondId} minSize="7rem" style={{ overflow: 'hidden' }}>
				<PaneNodeView {...props} node={split.second} />
			</Panel>
		</Group>
	);
}

function PaneView({
	dashboardId,
	dashboardLayout,
	focusedPaneId,
	pane,
	closable,
}: PaneNodeProps & { pane: Pane; closable: boolean }) {
	const [optionsOpen, setOptionsOpen] = useState(false);
	const update = (operation: (layout: PaneNode) => PaneNode) => updateLayout(dashboardId, operation);
	const { widget } = pane;
	const type = widget && getWidgetType(widget.type);
	const config = useMemo(() => widgetConfigSchema.parse(widget?.config), [widget?.config]);

	const setWidget = (newType: WidgetType, entries: readonly string[] = newType.defaultConfig.entries) => {
		const newConfig = { ...newType.defaultConfig, entries: [...entries] };
		update((layout) => setPaneWidget(layout, pane.id, { type: newType.id, config: newConfig }));
	};
	const changeWidget = (newType: WidgetType) => {
		// Entries missing from the source might be accepted once they're loaded, so only known mismatches are unbound
		const entries = config.entries.filter((name) => {
			const entry = getEntry(name);
			return entry === undefined || acceptsEntry(newType, entry);
		});
		setWidget(newType, entries.length > 0 ? entries : undefined);
	};
	// Keeps any other config fields as they are
	const setEntries = (entries: string[]) =>
		update((layout) =>
			setPaneWidget(
				layout,
				pane.id,
				widget && { ...widget, config: { ...(typeof widget.config === 'object' ? widget.config : {}), entries } },
			),
		);
	const split = (direction: SplitDirection) => splitDashboardPane(dashboardId, pane.id, direction);
	const canSplitRight = canSplitPane(dashboardLayout, pane.id, 'row');
	const canSplitDown = canSplitPane(dashboardLayout, pane.id, 'column');
	const close = () => closeDashboardPane(dashboardId, pane.id);

	const menuItems: MenuEntry[] = [
		{ label: 'Split right', icon: Columns2Icon, disabled: !canSplitRight, onSelect: () => split('row') },
		{ label: 'Split down', icon: Rows2Icon, disabled: !canSplitDown, onSelect: () => split('column') },
		'separator',
		{
			label: 'Change widget',
			icon: ReplaceIcon,
			disabled: widget === undefined,
			items: widgetTypes.map((other) => ({
				label: other.name,
				icon: other.icon,
				disabled: other === type,
				onSelect: () => changeWidget(other),
			})),
		},
		{ label: 'Widget options', icon: Settings2Icon, disabled: !type, onSelect: () => setOptionsOpen(true) },
		'separator',
		{ label: 'Close', icon: XIcon, shortcut: shortcuts.close, disabled: !closable, onSelect: close },
	];

	return (
		<AppContextMenu
			items={menuItems}
			render={
				<div
					className={cn(
						'relative flex size-full flex-col',
						pane.id === focusedPaneId &&
							'after:pointer-events-none after:absolute after:inset-0 after:ring-1 after:ring-primary/50 after:ring-inset',
					)}
					// Lets `addDashboardWidget()` pick a split direction from the pane's size
					data-pane-id={pane.id}
					// Capturing, so clicks that widgets handle themselves still focus the pane, right-clicks included
					onPointerDownCapture={() => focusPane(dashboardId, pane.id)}
					onFocusCapture={() => focusPane(dashboardId, pane.id)}
				/>
			}
		>
			<div className="flex h-9 shrink-0 items-center gap-0.5 border-b px-2">
				<span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground">
					{type && <type.icon className="size-3.5 shrink-0" />}
					<span className="truncate">{type?.name ?? widget?.type}</span>
				</span>
				{type && (
					<WidgetOptions
						type={type}
						entries={config.entries}
						onEntriesChange={setEntries}
						open={optionsOpen}
						onOpenChange={setOptionsOpen}
					/>
				)}
				<PaneButton label="Split right" disabled={!canSplitRight} onClick={() => split('row')}>
					<Columns2Icon />
				</PaneButton>
				<PaneButton label="Split down" disabled={!canSplitDown} onClick={() => split('column')}>
					<Rows2Icon />
				</PaneButton>
				{closable && (
					<PaneButton label="Close pane" shortcut={shortcuts.close} onClick={close}>
						<XIcon />
					</PaneButton>
				)}
			</div>
			<div className="min-h-0 flex-1">
				{widget === undefined ? (
					<AddWidgetPrompt onAdd={setWidget} />
				) : type ? (
					<WidgetView type={type} entries={config.entries} onEntriesChange={setEntries} />
				) : (
					<p className="p-3 text-sm text-muted-foreground">Unknown widget type {widget.type}.</p>
				)}
			</div>
		</AppContextMenu>
	);
}

/** Shown in empty panes */
function AddWidgetPrompt({ onAdd }: { onAdd: (type: WidgetType) => void }) {
	return (
		<Empty className="h-full overflow-auto">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<LayoutGridIcon />
				</EmptyMedia>
				<EmptyTitle>Add widget</EmptyTitle>
				<EmptyDescription>Choose a widget to show data in this pane.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Menu>
					<MenuTrigger render={<Button variant="outline" />}>
						Add widget
						<ChevronDownIcon />
					</MenuTrigger>
					<MenuPopup>
						{widgetTypes.map((type) => (
							<MenuItem key={type.id} onClick={() => onAdd(type)}>
								<type.icon />
								{type.name}
							</MenuItem>
						))}
					</MenuPopup>
				</Menu>
			</EmptyContent>
		</Empty>
	);
}

function PaneButton({
	label,
	shortcut,
	disabled = false,
	onClick,
	children,
}: {
	label: string;
	shortcut?: Hotkey;
	disabled?: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={<Button variant="ghost" size="icon-xs" aria-label={label} disabled={disabled} onClick={onClick} />}
			>
				{children}
			</TooltipTrigger>
			<TooltipPopup>
				<TooltipLabel label={label} shortcut={shortcut} />
			</TooltipPopup>
		</Tooltip>
	);
}
