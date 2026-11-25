import { Toolbar } from '@astryxdesign/core/Toolbar';
import * as stylex from '@stylexjs/stylex';
import XIcon from 'lucide-react/icons/x';
import { useMemo, useState } from 'react';
import { AddWidgetPrompt } from '@/panes/add-widget-prompt';
import {
	AppActionMenu,
	AppContextMenu,
	type MenuCheckbox,
	type MenuEntry,
	type MenuPoint,
} from '@/components/app-context-menu';
import { WidgetButtons } from '@/panes/widget-buttons';
import { PaneButton } from '@/panes/pane-button';
import { PaneTitle } from '@/panes/pane-title';
import { PaneLayoutButtons } from '@/panes/pane-layout-buttons';
import { splitMenuItems } from '@/panes/split-menu';
import { PaneDropIndicator } from '@/panes/pane-drop-indicator';
import { WidgetView } from '@/panes/widget-view';
import { shortcuts } from '@/commands/commands';
import { allowedActions, closeDashboardPane, splitDashboardPane, toggleZoom, updateLayout } from '@/dashboards/panes';
import { focusPane } from '@/dashboards/pane-state';
import { canCapture, copyImage } from '@/desktop/capture';
import { useVideoExport } from '@/desktop/video-export';
import { dragRegion } from '@/desktop/title-bar';
import { focusEditingPane, startEditing, useEditingPane } from '@/entries/editing';
import { getEntry, useEntries } from '@/data/data-store';
import {
	bindingLabel,
	changeWidgetType,
	createWidget,
	type Binding,
	removeBinding,
	resolveBindings,
	restoreBinding,
	widgetBindings,
} from '@/widgets/bindings';
import { useMobileLayout } from '@/lib/mobile-layout';
import { cn } from '@/lib/utils';
import { usePaneDrag } from '@/panes/drag';
import { bindingMenuItems } from '@/panes/binding-menu';
import { widgetMenuItems } from '@/panes/widget-menu';
import { type Pane, type PaneNode, setPaneWidget, type SplitDirection } from '@/panes/layout';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import { PanePresence } from '@/sharing/presence-avatars';
import { initialOptions, optionValues } from '@/widgets/options';
import { bindsEntries, type WidgetType, widgetTitle } from '@/widgets/widget-type';

export type PaneNodeProps = {
	dashboardId: string;
	dashboardLayout: PaneNode;
	focusedPaneId: string;
	/** The pane filling the dashboard while the others are hidden */
	zoomedPaneId: string | undefined;
	/** The pane zooming in, which fills the dashboard beneath the others as they slide away, see `useZoomAnimation()` */
	zoomFillingPaneId: string | undefined;
};

// Widgets mark the elements that show a binding, ex. a table row
const bindingIdAt = (target: EventTarget) =>
	target instanceof Element ? target.closest<HTMLElement>('[data-binding-id]')?.dataset['bindingId'] : undefined;

const styles = stylex.create({
	// The menu wraps the pane, which fills its place in the layout
	fill: {
		width: '100%',
		height: '100%',
	},
	// The pane header has its own padding
	controls: {
		padding: 0,
		flexShrink: 0,
	},
});

export function PaneView({
	dashboardId,
	dashboardLayout,
	focusedPaneId,
	zoomedPaneId,
	zoomFillingPaneId,
	pane,
	closable: closableHere,
}: PaneNodeProps & { pane: Pane; closable: boolean }) {
	const allowed = allowedActions(dashboardId, dashboardLayout, pane.id);
	const closable = closableHere && allowed.close;
	const update = (operation: (layout: PaneNode) => PaneNode) => updateLayout(dashboardId, operation);
	const { widget } = pane;
	const type = widget && getWidgetType(widget.type);
	const entries = useEntries();
	const bindings = useMemo(() => {
		const byName = new Map(entries.map((entry) => [entry.name, entry]));
		return type ? resolveBindings(type, widgetBindings(widget), (name) => byName.get(name)) : [];
	}, [entries, type, widget]);
	/** The bindings when either menu opened, so the ones removed from it stay listed and can be restored */
	const [menuBindings, setMenuBindings] = useState<Binding[]>();
	const onMenuOpenChange = (open: boolean) => setMenuBindings(open ? widgetBindings(widget) : undefined);
	const mobile = useMobileLayout();
	const options = useMemo(
		() => (type ? optionValues(type, widget, bindings, mobile) : {}),
		[type, widget, bindings, mobile],
	);
	const { dragRef, isDragging, dropRef, isDropTarget } = usePaneDrag(dashboardId, pane, allowed.move);
	const exporting = useVideoExport() !== undefined;
	const setWidget = (newType: WidgetType) =>
		update((layout) =>
			setPaneWidget(layout, pane.id, createWidget(newType, undefined, initialOptions(newType, layout))),
		);
	const changeWidget = (newType: WidgetType) =>
		update((layout) => changeWidgetType(layout, pane.id, newType, getEntry));
	const split = (direction: SplitDirection) => splitDashboardPane(dashboardId, pane.id, direction);
	const close = () => closeDashboardPane(dashboardId, pane.id);
	const focused = pane.id === focusedPaneId;
	const zoomed = pane.id === zoomedPaneId;
	const zoom = () => toggleZoom(dashboardId, pane.id);
	const editing = useEditingPane(dashboardId, pane.id);
	const focus = (target: EventTarget) => {
		focusPane(dashboardId, pane.id);
		focusEditingPane(dashboardId, pane.id, type !== undefined && bindsEntries(type), target);
	};
	const remove = (bindingId: string) => update((layout) => removeBinding(layout, pane.id, bindingId));

	const menuItems = (target: Element, point?: MenuPoint): MenuEntry[] => {
		const targetId = bindingIdAt(target);
		const targetBinding = bindings.find((binding) => binding.id === targetId);
		const captureTarget = STUDIO_DESKTOP && canCapture && widget ? target.closest('[data-pane-id]') : null;
		const listed = menuBindings ?? widgetBindings(widget);
		const listedLabels = type ? resolveBindings(type, listed, getEntry).map((binding) => bindingLabel(binding)) : [];
		const boundIds = new Set(bindings.map((binding) => binding.id));
		const { actions = [], contextual = [] } = widgetMenuItems(pane.id, targetBinding, target, point);
		return [
			...splitMenuItems(allowed, split),
			{
				label: zoomed ? 'Restore pane' : 'Zoom pane',
				shortcut: shortcuts.zoom,
				disabled: dashboardLayout.kind === 'pane',
				onSelect: zoom,
			},
			'separator',
			{
				label: widget === undefined ? 'Add widget' : 'Change widget',
				disabled: !allowed.changeWidget,
				items: widgetTypes.map((other) => ({
					label: other.name,
					accessKey: other.hotkey,
					disabled: other === type,
					onSelect: () => (widget === undefined ? setWidget(other) : changeWidget(other)),
				})),
			},
			...actions,
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
			...(targetBinding ? bindingMenuItems(dashboardId, pane, bindings, targetBinding, target) : []),
			...contextual,
			...(captureTarget ? [{ label: 'Copy image', onSelect: () => void copyImage(captureTarget) }] : []),
			'separator',
			{ label: 'Close', shortcut: shortcuts.close, disabled: !closable, onSelect: close },
		];
	};

	return (
		<AppContextMenu
			items={menuItems}
			label="Pane actions"
			disabled={exporting}
			onOpenChange={onMenuOpenChange}
			triggerXstyle={styles.fill}
		>
			<div
				ref={dropRef}
				className={cn(
					'group/pane relative flex size-full flex-col overflow-hidden rounded-lg bg-background transition-opacity',
					isDragging && 'opacity-40',
				)}
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
			>
				<div
					{...dragRegion}
					className={cn(
						'flex h-9 shrink-0 items-center gap-0.5 px-2 transition-colors',
						// Marks the widget whose entries the entry browser is editing
						editing && 'bg-primary/12 capture:bg-transparent capture:transition-none',
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
							movable={allowed.move}
							isDragging={isDragging}
							type={type}
							name={type ? widgetTitle(type, options) : widget?.type}
							onEdit={() => startEditing(dashboardId, pane.id)}
						/>
					</span>
					<PanePresence dashboardId={dashboardId} paneId={pane.id} />
					<Toolbar
						label="Pane controls"
						size="sm"
						gap={0.5}
						xstyle={styles.controls}
						className={cn(
							'capture-invisible transition-opacity duration-100',
							!mobile && !focused && 'opacity-0 group-hover/pane:opacity-100',
						)}
						endContent={
							<>
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
									splittable={allowed.splittable}
									canSplitRight={allowed.splitRight}
									canSplitDown={allowed.splitDown}
									canZoom={dashboardLayout.kind === 'split'}
									zoomed={zoomed}
									onSplit={split}
									onZoom={zoom}
								/>
								{!exporting && <AppActionMenu items={menuItems} label="Pane actions" onOpenChange={onMenuOpenChange} />}
								{closable && (
									<PaneButton label="Close pane" shortcut={shortcuts.close} onClick={close}>
										<XIcon />
									</PaneButton>
								)}
							</>
						}
					/>
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
			</div>
		</AppContextMenu>
	);
}
