import { XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AddWidgetPrompt } from '@/panes/add-widget-prompt';
import { AppContextMenu, type MenuCheckbox, type MenuEntry } from '@/components/app-context-menu';
import { WidgetButtons } from '@/panes/widget-buttons';
import { PaneButton } from '@/panes/pane-button';
import { PaneTitle } from '@/panes/pane-title';
import { PaneLayoutButtons } from '@/panes/pane-layout-buttons';
import { PaneDropIndicator } from '@/panes/pane-drop-indicator';
import { Toolbar } from '@/components/ui/toolbar';
import { WidgetView } from '@/panes/widget-view';
import { shortcuts } from '@/commands/commands';
import { closeDashboardPane, splitDashboardPane, toggleZoom, updateLayout } from '@/dashboards/panes';
import { focusPane } from '@/dashboards/pane-state';
import { focusEditingPane, startEditing, useEditingPane } from '@/entries/editing';
import { getEntry, useEntries } from '@/data/data-store';
import {
	bindingLabel,
	changeWidgetType,
	disconnectBindings,
	createWidget,
	type Binding,
	removeBinding,
	resolveBindings,
	restoreBinding,
	setBindingRole,
	widgetBindings,
} from '@/widgets/bindings';
import { cn } from '@/lib/utils';
import { usePaneDrag } from '@/panes/drag';
import { canSplitPane, type Pane, type PaneNode, setPaneWidget, type SplitDirection } from '@/panes/layout';
import { useTrafficLightsOverlap } from '@/desktop/title-bar';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import { PanePresence } from '@/sharing/presence-avatars';
import { initialOptions, optionValues } from '@/widgets/options';
import { bindsEntries, type WidgetBinding, type WidgetType, widgetTitle } from '@/widgets/widget-type';

export type PaneNodeProps = {
	dashboardId: string;
	dashboardLayout: PaneNode;
	focusedPaneId: string;
	/** The pane filling the dashboard while the others are hidden */
	zoomedPaneId: string | undefined;
	/** The pane zooming in, which fills the dashboard beneath the others as they slide away, see `useZoomAnimation()` */
	zoomFillingPaneId: string | undefined;
	/** Whether the node is in the top left corner of the dashboard, under the traffic lights and the buttons after them when the sidebar is collapsed */
	topLeft: boolean;
};

// Widgets mark the elements that show a binding, ex. a table row
const bindingIdAt = (target: EventTarget) =>
	target instanceof Element ? target.closest<HTMLElement>('[data-binding-id]')?.dataset['bindingId'] : undefined;

export function PaneView({
	dashboardId,
	dashboardLayout,
	focusedPaneId,
	zoomedPaneId,
	zoomFillingPaneId,
	topLeft,
	pane,
	closable,
}: PaneNodeProps & { pane: Pane; closable: boolean }) {
	const trafficLightsOverlap = useTrafficLightsOverlap();
	const update = (operation: (layout: PaneNode) => PaneNode) => updateLayout(dashboardId, operation);
	const { widget } = pane;
	const type = widget && getWidgetType(widget.type);
	const entries = useEntries();
	const bindings = useMemo(() => {
		const byName = new Map(entries.map((entry) => [entry.name, entry]));
		return type ? resolveBindings(type, widgetBindings(widget), (name) => byName.get(name)) : [];
	}, [entries, type, widget]);
	/** The bindings when the context menu opened, so the ones removed from it stay listed and can be restored */
	const [menuBindings, setMenuBindings] = useState<Binding[]>();
	const options = useMemo(() => (type ? optionValues(type, widget, bindings) : {}), [type, widget, bindings]);
	const { dragRef, isDragging, dropRef, isDropTarget } = usePaneDrag(dashboardId, pane);

	const setWidget = (newType: WidgetType) =>
		update((layout) =>
			setPaneWidget(layout, pane.id, createWidget(newType, undefined, initialOptions(newType, layout))),
		);
	const changeWidget = (newType: WidgetType) =>
		update((layout) => changeWidgetType(layout, pane.id, newType, getEntry));
	const split = (direction: SplitDirection) => splitDashboardPane(dashboardId, pane.id, direction);
	const canSplitRight = canSplitPane(dashboardLayout, pane.id, 'row');
	const canSplitDown = canSplitPane(dashboardLayout, pane.id, 'column');
	const close = () => closeDashboardPane(dashboardId, pane.id);
	const focused = pane.id === focusedPaneId;
	const zoomed = pane.id === zoomedPaneId;
	// The header makes room for the traffic lights and continues the title bar under them, see `TitleBar`
	const underTrafficLights = trafficLightsOverlap && (topLeft || zoomed);
	const zoom = () => toggleZoom(dashboardId, pane.id);

	const editing = useEditingPane(dashboardId, pane.id);
	const focus = (target: EventTarget) => {
		focusPane(dashboardId, pane.id);
		focusEditingPane(dashboardId, pane.id, type !== undefined && bindsEntries(type), target);
	};

	const remove = (bindingId: string) => update((layout) => removeBinding(layout, pane.id, bindingId));

	/** Disconnects the binding from the others it's connected to either way, ex. a robot from the tags it sees */
	const disconnectItems = (binding: WidgetBinding | undefined): MenuEntry[] => {
		const connections =
			binding === undefined
				? []
				: bindings.flatMap((target) =>
						target.sources
							.filter((source) => source.id === binding.id || target.id === binding.id)
							.map((source) => ({ source, target })),
					);
		return connections.length === 0
			? []
			: [
					{
						label: 'Disconnect',
						items: connections.map(({ source, target }) => ({
							label: `${bindingLabel(source)} → ${bindingLabel(target)}`,
							onSelect: () => update((layout) => disconnectBindings(layout, pane.id, source.id, target.id)),
						})),
					},
				];
	};

	/** Picks what the binding is drawn as, ex. on a graph's right axis */
	const roleItems = (binding: WidgetBinding | undefined): MenuEntry[] =>
		binding === undefined || binding.roles.length < 2
			? []
			: [
					'separator',
					...binding.roles.map((role): MenuCheckbox => ({
						label: role.label,
						checked: role.id === binding.role?.id,
						onCheckedChange: () => update((layout) => setBindingRole(layout, pane.id, binding.id, role.id)),
					})),
				];

	const menuItems = (target: Element): MenuEntry[] => {
		const targetId = bindingIdAt(target);
		const targetBinding = bindings.find((binding) => binding.id === targetId);
		const listed = menuBindings ?? widgetBindings(widget);
		const listedLabels = type ? resolveBindings(type, listed, getEntry).map((binding) => bindingLabel(binding)) : [];
		const boundIds = new Set(bindings.map((binding) => binding.id));
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
			{
				label: zoomed ? 'Restore pane' : 'Zoom pane',
				shortcut: shortcuts.zoom,
				disabled: dashboardLayout.kind === 'pane',
				onSelect: zoom,
			},
			'separator',
			{
				label: widget === undefined ? 'Add widget' : 'Change widget',
				items: widgetTypes.map((other) => ({
					label: other.name,
					accessKey: other.hotkey,
					disabled: other === type,
					onSelect: () => (widget === undefined ? setWidget(other) : changeWidget(other)),
				})),
			},
			{
				label: 'Edit entries',
				shortcut: shortcuts.editEntries,
				disabled: !type || !bindsEntries(type),
				onSelect: () => startEditing(dashboardId, pane.id),
			},
			targetBinding === undefined
				? {
						label: 'Entries',
						disabled: listed.length === 0,
						items: listed.map((binding, index): MenuCheckbox => ({
							label: listedLabels[index]!,
							checked: boundIds.has(binding.id),
							onCheckedChange: (checked) =>
								checked ? update((layout) => restoreBinding(layout, pane.id, binding, listed)) : remove(binding.id),
						})),
					}
				: { label: `Remove ${bindingLabel(targetBinding)}`, onSelect: () => remove(targetBinding.id) },
			...disconnectItems(targetBinding),
			...roleItems(targetBinding),
			'separator',
			{ label: 'Close', shortcut: shortcuts.close, disabled: !closable, onSelect: close },
		];
	};

	return (
		<AppContextMenu
			items={menuItems}
			onOpenChange={(open) => setMenuBindings(open ? widgetBindings(widget) : undefined)}
			render={
				<div
					ref={dropRef}
					className={cn('group/pane relative flex size-full flex-col transition-opacity', isDragging && 'opacity-40')}
					// Lets `addDashboardWidget()` pick a split direction from the pane's size
					data-pane-id={pane.id}
					data-zoom-filling={pane.id === zoomFillingPaneId || undefined}
					// Capturing, so clicks that widgets handle themselves still focus the pane, right-clicks included
					onPointerDownCapture={(event) => focus(event.target)}
					onFocusCapture={(event) => focus(event.target)}
					// Middle-clicking a binding removes it
					onAuxClick={(event) => {
						const bindingId = event.button === 1 ? bindingIdAt(event.target) : undefined;
						if (bindingId !== undefined) {
							remove(bindingId);
						}
					}}
				/>
			}
		>
			<div
				data-joins-title-bar={underTrafficLights}
				className={cn(
					'flex h-9 shrink-0 items-center gap-0.5 border-b px-2 transition-colors',
					underTrafficLights && 'ps-[calc(var(--title-bar-overlap)+--spacing(1.5))]',
					// Marks the widget whose entries the entry browser is editing
					editing && 'bg-primary/12',
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
						isDragging={isDragging}
						type={type}
						name={type ? widgetTitle(type, options) : widget?.type}
						onEdit={() => startEditing(dashboardId, pane.id)}
					/>
				</span>
				<PanePresence dashboardId={dashboardId} paneId={pane.id} />
				{/* Pane controls stay out of the way unless the pane is hovered or focused */}
				<Toolbar
					aria-label="Pane controls"
					className={cn(
						'items-center gap-0.5 rounded-none border-0 bg-transparent p-0 transition-opacity duration-100',
						!focused && 'opacity-0 group-hover/pane:opacity-100',
					)}
				>
					{type && (
						<WidgetButtons
							dashboardId={dashboardId}
							paneId={pane.id}
							type={type}
							widget={widget}
							bindings={bindings}
							editing={editing}
						/>
					)}
					<PaneLayoutButtons
						canSplitRight={canSplitRight}
						canSplitDown={canSplitDown}
						canZoom={dashboardLayout.kind === 'split'}
						zoomed={zoomed}
						onSplit={split}
						onZoom={zoom}
					/>
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
					<WidgetView dashboardId={dashboardId} paneId={pane.id} type={type} bindings={bindings} options={options} />
				) : (
					<p className="p-3 text-sm text-muted-foreground">Unknown widget type {widget.type}.</p>
				)}
			</div>
			{isDropTarget && <PaneDropIndicator layout={dashboardLayout} paneId={pane.id} />}
		</AppContextMenu>
	);
}
