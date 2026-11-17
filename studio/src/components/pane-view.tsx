import { Columns2Icon, MoveIcon, Rows2Icon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AddWidgetPrompt } from '@/components/add-widget-prompt';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { WidgetOptions } from '@/components/entry-picker';
import { PaneButton } from '@/components/pane-button';
import { PaneDropIndicator } from '@/components/pane-drop-indicator';
import { Toolbar } from '@/components/ui/toolbar';
import { WidgetView } from '@/components/widget-view';
import { shortcuts } from '@/commands';
import { closeDashboardPane, splitDashboardPane, updateLayout } from '@/dashboard-panes';
import { focusPane } from '@/dashboards';
import { getEntry } from '@/data/data-store';
import { cn } from '@/lib/utils';
import { usePaneDrag } from '@/pane-drag';
import {
	canSplitPane,
	type Pane,
	type PaneNode,
	setPaneEntryNames,
	setPaneWidget,
	type SplitDirection,
} from '@/pane-layout';
import { useTrafficLightsOverlap } from '@/title-bar';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import { acceptsEntry, type WidgetType, widgetConfigSchema } from '@/widgets/widget-type';

export type PaneNodeProps = {
	dashboardId: string;
	dashboardLayout: PaneNode;
	focusedPaneId: string;
	/** Whether the node is in the top left corner of the dashboard, under the traffic lights when the sidebar is collapsed */
	topLeft: boolean;
};

// Widgets mark the elements that show an entry, ex. a values table row
const entryNameAt = (target: EventTarget) =>
	target instanceof Element ? target.closest<HTMLElement>('[data-entry-name]')?.dataset['entryName'] : undefined;

export function PaneView({
	dashboardId,
	dashboardLayout,
	focusedPaneId,
	topLeft,
	pane,
	closable,
}: PaneNodeProps & { pane: Pane; closable: boolean }) {
	const trafficLightsOverlap = useTrafficLightsOverlap();
	const [optionsOpen, setOptionsOpen] = useState(false);
	const update = (operation: (layout: PaneNode) => PaneNode) => updateLayout(dashboardId, operation);
	const { widget } = pane;
	const type = widget && getWidgetType(widget.type);
	const config = useMemo(() => widgetConfigSchema.parse(widget?.config), [widget?.config]);
	const { draggable, dragRef, isDragging, dropRef, isDropTarget } = usePaneDrag(dashboardId, dashboardLayout, pane);

	const setWidget = (newType: WidgetType, entryNames: readonly string[] = newType.defaultConfig.entryNames) => {
		const newConfig = { ...newType.defaultConfig, entryNames: [...entryNames] };
		update((layout) => setPaneWidget(layout, pane.id, { type: newType.id, config: newConfig }));
	};
	const changeWidget = (newType: WidgetType) => {
		// Entries missing from the source might be accepted once they're loaded, so only known mismatches are unbound
		const entryNames = config.entryNames.filter((name) => {
			const entry = getEntry(name);
			return entry === undefined || acceptsEntry(newType, entry);
		});
		setWidget(newType, entryNames.length > 0 ? entryNames : undefined);
	};
	const setEntryNames = (entryNames: string[]) => update((layout) => setPaneEntryNames(layout, pane.id, entryNames));
	const split = (direction: SplitDirection) => splitDashboardPane(dashboardId, pane.id, direction);
	const canSplitRight = canSplitPane(dashboardLayout, pane.id, 'row');
	const canSplitDown = canSplitPane(dashboardLayout, pane.id, 'column');
	const close = () => closeDashboardPane(dashboardId, pane.id);
	const focused = pane.id === focusedPaneId;

	const removeEntry = (name: string) => setEntryNames(config.entryNames.filter((other) => other !== name));

	const menuItems = (target: Element): MenuEntry[] => {
		const targetEntryName = entryNameAt(target);
		return [
			{
				label: 'Split right',
				shortcut: shortcuts.splitRight,
				disabled: !canSplitRight,
				onSelect: () => split('row'),
			},
			{
				label: 'Split down',
				shortcut: shortcuts.splitDown,
				disabled: !canSplitDown,
				onSelect: () => split('column'),
			},
			'separator',
			{
				label: 'Change widget',
				disabled: widget === undefined,
				items: widgetTypes.map((other) => ({
					label: other.name,
					accessKey: other.hotkey,
					disabled: other === type,
					onSelect: () => changeWidget(other),
				})),
			},
			{ label: 'Add entries', disabled: !type, onSelect: () => setOptionsOpen(true) },
			targetEntryName === undefined
				? {
						label: 'Remove entry',
						disabled: config.entryNames.length === 0,
						items: config.entryNames.map((name) => ({ label: name, onSelect: () => removeEntry(name) })),
					}
				: { label: `Remove ${targetEntryName}`, onSelect: () => removeEntry(targetEntryName) },
			'separator',
			{ label: 'Close', shortcut: shortcuts.close, disabled: !closable, onSelect: close },
		];
	};

	return (
		<AppContextMenu
			items={menuItems}
			render={
				<div
					ref={dropRef}
					className={cn('group/pane relative flex size-full flex-col transition-opacity', isDragging && 'opacity-40')}
					// Lets `addDashboardWidget()` pick a split direction from the pane's size
					data-pane-id={pane.id}
					// Capturing, so clicks that widgets handle themselves still focus the pane, right-clicks included
					onPointerDownCapture={() => focusPane(dashboardId, pane.id)}
					onFocusCapture={() => focusPane(dashboardId, pane.id)}
					// Middle-clicking an entry removes it
					onAuxClick={(event) => {
						const entryName = event.button === 1 ? entryNameAt(event.target) : undefined;
						if (entryName !== undefined) {
							removeEntry(entryName);
						}
					}}
				/>
			}
		>
			<div
				className={cn(
					'flex h-9 shrink-0 items-center gap-0.5 border-b px-2',
					topLeft && trafficLightsOverlap && 'ps-10',
				)}
				// Middle-clicking the header closes the pane, like a browser tab
				onAuxClick={(event) => {
					if (event.button === 1 && closable) {
						close();
					}
				}}
			>
				<span className="flex min-w-0 flex-1">
					<PaneTitle
						dragRef={dragRef}
						draggable={draggable}
						isDragging={isDragging}
						icon={type?.icon}
						name={type?.name ?? widget?.type}
					/>
				</span>
				{/* Pane controls stay out of the way unless the pane is hovered or focused */}
				<Toolbar
					aria-label="Pane controls"
					className={cn(
						'items-center gap-0.5 rounded-none border-0 bg-transparent p-0 transition-opacity duration-75',
						!focused && 'opacity-0 group-hover/pane:opacity-100',
					)}
				>
					{type && (
						<WidgetOptions
							type={type}
							entryNames={config.entryNames}
							onEntryNamesChange={setEntryNames}
							open={optionsOpen}
							onOpenChange={setOptionsOpen}
						/>
					)}
					<PaneButton
						label="Split right"
						shortcut={shortcuts.splitRight}
						disabled={!canSplitRight}
						onClick={() => split('row')}
					>
						<Columns2Icon />
					</PaneButton>
					<PaneButton
						label="Split down"
						shortcut={shortcuts.splitDown}
						disabled={!canSplitDown}
						onClick={() => split('column')}
					>
						<Rows2Icon />
					</PaneButton>
					{closable && (
						<PaneButton label="Close pane" shortcut={shortcuts.close} onClick={close}>
							<XIcon />
						</PaneButton>
					)}
				</Toolbar>
			</div>
			<div className="min-h-0 flex-1">
				{widget === undefined ? (
					<AddWidgetPrompt onAdd={setWidget} focused={focused} />
				) : type ? (
					<WidgetView paneId={pane.id} type={type} entryNames={config.entryNames} />
				) : (
					<p className="p-3 text-sm text-muted-foreground">Unknown widget type {widget.type}.</p>
				)}
			</div>
			{isDropTarget && <PaneDropIndicator layout={dashboardLayout} paneId={pane.id} />}
		</AppContextMenu>
	);
}

/** Like Rex, panes are dragged by their title, which shows a move icon and a background while hovered or dragged */
function PaneTitle({
	dragRef,
	draggable,
	isDragging,
	icon: Icon,
	name,
}: {
	dragRef: (element: Element | null) => void;
	draggable: boolean;
	isDragging: boolean;
	icon: WidgetType['icon'] | undefined;
	name: string | undefined;
}) {
	return (
		<span
			ref={dragRef}
			data-dragging={isDragging || undefined}
			className={cn(
				'group/title -ms-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium text-muted-foreground outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring',
				draggable &&
					'hover:bg-accent hover:text-accent-foreground data-dragging:bg-accent data-dragging:text-accent-foreground',
			)}
		>
			{Icon && (
				<Icon
					className={cn('size-3.5 shrink-0', draggable && 'group-hover/title:hidden group-data-dragging/title:hidden')}
				/>
			)}
			{draggable && (
				<MoveIcon className="hidden size-3.5 shrink-0 group-hover/title:block group-data-dragging/title:block" />
			)}
			<span className="truncate">{name}</span>
		</span>
	);
}
