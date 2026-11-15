import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import { ChevronDownIcon, Columns2Icon, LayoutGridIcon, Rows2Icon, XIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { WidgetOptions } from '@/components/entry-picker';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
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
import { cn } from '@/lib/utils';
import { type Pane, type PaneNode, resizeSplit, setPaneWidget, type Split } from '@/pane-layout';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import { type WidgetType, widgetConfigSchema } from '@/widgets/widget-type';

type PaneNodeProps = {
	dashboardId: string;
	/** Only set when there's more than one pane */
	focusedPaneId: string | undefined;
};

export function DashboardPanes({ dashboard }: { dashboard: Dashboard }) {
	const { layout } = dashboard;
	const focusedPaneId = layout.kind === 'split' ? getFocusedPane(dashboard).id : undefined;
	return <PaneNodeView dashboardId={dashboard.id} focusedPaneId={focusedPaneId} node={layout} root />;
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

function PaneView({ dashboardId, focusedPaneId, pane, closable }: PaneNodeProps & { pane: Pane; closable: boolean }) {
	const formatForDisplay = useFormatForDisplay();
	const update = (operation: (layout: PaneNode) => PaneNode) => updateLayout(dashboardId, operation);
	const { widget } = pane;
	const type = widget && getWidgetType(widget.type);
	const config = useMemo(() => widgetConfigSchema.parse(widget?.config), [widget?.config]);

	const addWidget = (newType: WidgetType) => {
		const newConfig = { ...newType.defaultConfig, entries: [...newType.defaultConfig.entries] };
		update((layout) => setPaneWidget(layout, pane.id, { type: newType.id, config: newConfig }));
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

	return (
		<div
			className={cn(
				'relative flex size-full flex-col',
				pane.id === focusedPaneId &&
					'after:pointer-events-none after:absolute after:inset-0 after:ring-1 after:ring-primary/50 after:ring-inset',
			)}
			// Capturing, so clicks that widgets handle themselves still focus the pane
			onPointerDownCapture={() => focusPane(dashboardId, pane.id)}
			onFocusCapture={() => focusPane(dashboardId, pane.id)}
		>
			<div className="flex h-9 shrink-0 items-center gap-0.5 border-b px-2">
				<span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground">
					{type && <type.icon className="size-3.5 shrink-0" />}
					<span className="truncate">{type?.name ?? widget?.type}</span>
				</span>
				{type && <WidgetOptions type={type} entries={config.entries} onEntriesChange={setEntries} />}
				<PaneButton label="Split right" onClick={() => splitDashboardPane(dashboardId, pane.id, 'row')}>
					<Columns2Icon />
				</PaneButton>
				<PaneButton label="Split down" onClick={() => splitDashboardPane(dashboardId, pane.id, 'column')}>
					<Rows2Icon />
				</PaneButton>
				{closable && (
					<PaneButton
						label="Close pane"
						shortcut={formatForDisplay(shortcuts.close)}
						onClick={() => closeDashboardPane(dashboardId, pane.id)}
					>
						<XIcon />
					</PaneButton>
				)}
			</div>
			<div className="min-h-0 flex-1">
				{widget === undefined ? (
					<AddWidgetPrompt onAdd={addWidget} />
				) : type ? (
					<WidgetView type={type} entries={config.entries} onEntriesChange={setEntries} />
				) : (
					<p className="p-3 text-sm text-muted-foreground">Unknown widget type {widget.type}.</p>
				)}
			</div>
		</div>
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
	onClick,
	children,
}: {
	label: string;
	shortcut?: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label={label} onClick={onClick} />}>
				{children}
			</TooltipTrigger>
			<TooltipPopup>
				<span className="flex items-center gap-2">
					{label}
					{shortcut !== undefined && <Kbd>{shortcut}</Kbd>}
				</span>
			</TooltipPopup>
		</Tooltip>
	);
}
