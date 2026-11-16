import type { Hotkey } from '@tanstack/react-hotkeys';
import { Columns2Icon, Rows2Icon, XIcon } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator, useGroupRef } from 'react-resizable-panels';
import { AddWidgetPrompt } from '@/components/add-widget-prompt';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { WidgetOptions } from '@/components/entry-picker';
import { Button } from '@/components/ui/button';
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
	const groupRef = useGroupRef();

	// The group only reads `defaultLayout` when it mounts, so a ratio changed by undo or redo is applied here
	useEffect(() => {
		groupRef.current?.setLayout({ [firstId]: split.ratio * 100, [secondId]: (1 - split.ratio) * 100 });
	}, [groupRef, firstId, secondId, split.ratio]);

	return (
		<Group
			groupRef={groupRef}
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
				// The library's 10px hit area is mostly outside the line, so the pseudo-element catches double-clicks there
				className={cn(
					'bg-border outline-none transition-colors focus-visible:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring',
					'relative z-10 after:absolute',
					row ? 'w-px after:inset-y-0 after:-inset-x-[4.5px]' : 'h-px after:inset-x-0 after:-inset-y-[4.5px]',
				)}
				onDoubleClick={() => {
					groupRef.current?.setLayout({ [firstId]: 50, [secondId]: 50 });
					updateLayout(dashboardId, (layout) => resizeSplit(layout, split.id, 0.5));
				}}
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
	// Keeps any other config fields as they are
	const setEntryNames = (entryNames: string[]) =>
		update((layout) =>
			setPaneWidget(
				layout,
				pane.id,
				widget && {
					...widget,
					config: { ...(typeof widget.config === 'object' ? widget.config : {}), entryNames },
				},
			),
		);
	const split = (direction: SplitDirection) => splitDashboardPane(dashboardId, pane.id, direction);
	const canSplitRight = canSplitPane(dashboardLayout, pane.id, 'row');
	const canSplitDown = canSplitPane(dashboardLayout, pane.id, 'column');
	const close = () => closeDashboardPane(dashboardId, pane.id);

	const menuItems: MenuEntry[] = [
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
				disabled: other === type,
				onSelect: () => changeWidget(other),
			})),
		},
		{ label: 'Widget options', disabled: !type, onSelect: () => setOptionsOpen(true) },
		'separator',
		{ label: 'Close', shortcut: shortcuts.close, disabled: !closable, onSelect: close },
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
			</div>
			<div className="min-h-0 flex-1">
				{widget === undefined ? (
					<AddWidgetPrompt onAdd={setWidget} />
				) : type ? (
					<WidgetView type={type} entryNames={config.entryNames} onEntryNamesChange={setEntryNames} />
				) : (
					<p className="p-3 text-sm text-muted-foreground">Unknown widget type {widget.type}.</p>
				)}
			</div>
		</AppContextMenu>
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
