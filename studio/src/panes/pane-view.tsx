import { Text } from '@astryxdesign/core/Text';
import { colorVars, durationVars, easeVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Toolbar } from '@astryxdesign/core/Toolbar';
import * as stylex from '@stylexjs/stylex';
import XIcon from 'lucide-react/icons/x';
import { useMemo, useState } from 'react'; // oxlint-disable studio/no-manual-memo -- React Compiler doesn't memoize `bindings` or `options` on its own
import { AddWidgetPrompt } from '@/panes/add-widget-prompt';
import { AppContextMenu, type MenuCheckbox, type MenuEntry, type MenuPoint } from '@/components/app-context-menu';
import { WidgetButtons } from '@/panes/widget-buttons';
import { PaneButton } from '@/panes/pane-button';
import { PaneTitle } from '@/panes/pane-title';
import { PaneLayoutButtons } from '@/panes/pane-layout-buttons';
import { layoutMenuItems } from '@/panes/split-menu';
import { PaneDropIndicator } from '@/panes/pane-drop-indicator';
import { WidgetView } from '@/panes/widget-view';
import { useBindingSources } from '@/widgets/source-entries';
import { shortcuts } from '@/commands/commands';
import { allowedActions, closeDashboardPane, splitDashboardPane, toggleZoom, updateLayout } from '@/dashboards/panes';
import { focusPane } from '@/dashboards/pane-state';
import { canCapture, copyImage } from '@/desktop/capture';
import { useVideoExport } from '@/desktop/video-export';
import { dragRegion } from '@/desktop/title-bar';
import { focusEditingPane, startEditing, useEditingPane } from '@/entries/editing';
import { getEntry } from '@/data/data-store';
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
import { usePaneDrag } from '@/panes/drag';
import { usePaneSwipeArea } from '@/panes/pane-swipe';
import { bindingMenuItems } from '@/panes/binding-menu';
import { widgetMenuItems } from '@/panes/widget-menu';
import { type Pane, type PaneNode, setPaneWidget, type SplitDirection } from '@/panes/layout';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import { PanePresence } from '@/sharing/presence-avatars';
import { initialOptions, optionValues } from '@/widgets/options';
import { bindsEntries, type WidgetType, widgetTitle } from '@/widgets/widget-type';
import './pane-view.css';

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
	// The pane and the menu wrapping it fill its place in the layout
	fill: { width: '100%', height: '100%' },
	pane: {
		position: 'relative',
		display: 'flex',
		flexDirection: 'column',
		// `PhonePanes` makes panes fill the screen's width instead
		paddingInline: 'var(--pane-padding-inline)',
		overflow: 'hidden',
		borderRadius: `var(--pane-radius, ${radiusVars['--radius-element']})`,
		backgroundColor: colorVars['--color-background-surface'],
		transition: `opacity ${durationVars['--duration-fast']} ${easeVars['--ease-standard']}`,
	},
	dragged: { opacity: 0.4 },
	header: {
		position: 'relative',
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-0-5'],
		height: 36,
		paddingInline: spacingVars['--spacing-2'],
		transition: `background-color ${durationVars['--duration-fast']} ${easeVars['--ease-standard']}`,
	},
	// Marks the widget whose entries the entry browser is editing
	editing: { backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 12%, transparent)` },
	title: { display: 'flex', flex: 1, minWidth: 0 },
	// The pane header has its own padding, the toolbar's Section pads an inner element with this
	controls: { flexShrink: 0, '--astryx-section-padding-inline': '0px' },
	content: { flex: 1, minHeight: 0 },
	unknown: { padding: spacingVars['--spacing-3'] },
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
	const mobile = useMobileLayout();
	// Dragging the header switches panes in the phone layout instead
	const movable = allowed.move && !mobile;
	const update = (operation: (layout: PaneNode) => PaneNode) => updateLayout(dashboardId, operation);
	const { widget } = pane;
	const type = widget && getWidgetType(widget.type);
	const sources = useBindingSources();
	const bindings = useMemo(
		() => (type ? resolveBindings(type, widgetBindings(widget), () => undefined, sources) : []),
		[sources, type, widget],
	);
	/** The bindings when the menu opened, so the ones removed from it stay listed and can be restored */
	const [menuBindings, setMenuBindings] = useState<Binding[]>();
	const onMenuOpenChange = (open: boolean) => setMenuBindings(open ? widgetBindings(widget) : undefined);
	const header = usePaneSwipeArea();
	const options = useMemo(
		() => (type ? optionValues(type, widget, bindings, mobile) : {}),
		[type, widget, bindings, mobile],
	);
	const { dragRef, isDragging, dropRef, isDropTarget } = usePaneDrag(dashboardId, pane, movable);
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
			...layoutMenuItems(allowed, split, { zoomed, canZoom: dashboardLayout.kind === 'split', onZoom: zoom }),
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
				{...stylex.props(styles.fill, styles.pane, isDragging && styles.dragged)}
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
					ref={header}
					{...dragRegion}
					{...stylex.props(styles.header, editing && styles.editing)}
					data-pane-header
					// Middle-clicking the header closes the pane, like a browser tab
					onAuxClick={(event) => {
						if (event.button === 1 && closable) {
							close();
						}
					}}
				>
					<span {...stylex.props(styles.title)}>
						<PaneTitle
							dragRef={dragRef}
							movable={movable}
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
						className={!mobile && !focused ? 'capture-hidden pane-controls-on-interaction' : 'capture-hidden'}
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
								{allowed.closable && (
									<PaneButton
										label="Close pane"
										shortcut={shortcuts.close}
										disabled={!closable}
										onClick={close}
										icon={XIcon}
									/>
								)}
							</>
						}
					/>
				</div>
				<div {...stylex.props(styles.content)}>
					{widget === undefined ? (
						<AddWidgetPrompt onAdd={setWidget} focused={focused} />
					) : type ? (
						<WidgetView dashboardId={dashboardId} paneId={pane.id} type={type} bindings={bindings} options={options} />
					) : (
						<Text as="p" color="secondary" xstyle={styles.unknown}>
							Unknown widget type {widget.type}.
						</Text>
					)}
				</div>
				{isDropTarget && <PaneDropIndicator layout={dashboardLayout} paneId={pane.id} />}
			</div>
		</AppContextMenu>
	);
}
