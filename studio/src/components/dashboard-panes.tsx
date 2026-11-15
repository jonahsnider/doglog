import { ChevronDownIcon, Columns2Icon, LayoutGridIcon, Rows2Icon, XIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { WidgetOptions } from '@/components/entry-picker';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { WidgetView } from '@/components/widget-view';
import { updateLayout } from '@/dashboards';
import { cn } from '@/lib/utils';
import { closePane, type Pane, type PaneNode, resizeSplit, setPaneWidget, type Split, splitPane } from '@/pane-layout';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import { type WidgetType, widgetConfigSchema } from '@/widgets/widget-type';

export function DashboardPanes({ dashboardId, layout }: { dashboardId: string; layout: PaneNode }) {
	return <PaneNodeView dashboardId={dashboardId} node={layout} root />;
}

function PaneNodeView({ dashboardId, node, root = false }: { dashboardId: string; node: PaneNode; root?: boolean }) {
	return node.kind === 'pane' ? (
		// Closing the only pane does nothing unless there's a widget to remove
		<PaneView dashboardId={dashboardId} pane={node} closable={!root || node.widget !== undefined} />
	) : (
		// Keyed so a split that takes another's place reads its own saved ratio
		<SplitView key={node.id} dashboardId={dashboardId} split={node} />
	);
}

function SplitView({ dashboardId, split }: { dashboardId: string; split: Split }) {
	const row = split.direction === 'row';
	const firstId = `${split.id}-first`;
	const secondId = `${split.id}-second`;

	return (
		<Group
			orientation={row ? 'horizontal' : 'vertical'}
			defaultLayout={{ [firstId]: split.ratio * 100, [secondId]: (1 - split.ratio) * 100 }}
			// Called once a drag is released or a key is pressed, not on every pointer move
			onLayoutChanged={(layout, { isUserInteraction, requestedLayout = layout }) => {
				const size = requestedLayout[firstId];
				if (isUserInteraction && size !== undefined) {
					updateLayout(dashboardId, (layout) => resizeSplit(layout, split.id, size / 100));
				}
			}}
		>
			{/* Keep panes big enough for their controls */}
			<Panel id={firstId} minSize="7rem" style={{ overflow: 'hidden' }}>
				<PaneNodeView dashboardId={dashboardId} node={split.first} />
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
				<PaneNodeView dashboardId={dashboardId} node={split.second} />
			</Panel>
		</Group>
	);
}

function PaneView({ dashboardId, pane, closable }: { dashboardId: string; pane: Pane; closable: boolean }) {
	const update = (operation: (layout: PaneNode) => PaneNode) => updateLayout(dashboardId, operation);
	const { widget } = pane;
	const type = widget && getWidgetType(widget.type);
	const config = useMemo(() => widgetConfigSchema.parse(widget?.config), [widget?.config]);

	const addWidget = (newType: WidgetType) => {
		const config = { ...newType.defaultConfig, entries: [...newType.defaultConfig.entries] };
		update((layout) => setPaneWidget(layout, pane.id, { type: newType.id, config }));
	};
	// Keeps any other config fields as they are
	const setEntries = (entries: string[]) =>
		update((layout) =>
			setPaneWidget(layout, pane.id, widget && { ...widget, config: { ...(widget.config as object), entries } }),
		);

	return (
		<div className="flex size-full flex-col">
			<div className="flex h-9 shrink-0 items-center gap-0.5 border-b px-2">
				<span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground">
					{type && <type.icon className="size-3.5 shrink-0" />}
					<span className="truncate">{type?.name ?? widget?.type}</span>
				</span>
				{type && <WidgetOptions type={type} entries={config.entries} onEntriesChange={setEntries} />}
				<PaneButton label="Split right" onClick={() => update((layout) => splitPane(layout, pane.id, 'row'))}>
					<Columns2Icon />
				</PaneButton>
				<PaneButton label="Split down" onClick={() => update((layout) => splitPane(layout, pane.id, 'column'))}>
					<Rows2Icon />
				</PaneButton>
				{closable && (
					<PaneButton label="Close pane" onClick={() => update((layout) => closePane(layout, pane.id))}>
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

function PaneButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label={label} onClick={onClick} />}>
				{children}
			</TooltipTrigger>
			<TooltipPopup>{label}</TooltipPopup>
		</Tooltip>
	);
}
