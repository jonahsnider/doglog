import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor } from '@dnd-kit/react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Group, type Layout, Separator, useGroupRef } from 'react-resizable-panels';
import { PaneView, type PaneNodeProps } from '@/panes/pane-view';
import { dropDashboardEntry, getFocusedPane, getZoomedPane, updateLayout } from '@/dashboards/panes';
import type { Dashboard } from '@/dashboards/dashboards';
import { type EntryDragData, type EntryDropData, type EntrySectionDropData, entryDragType } from '@/entries/drag';
import { useMinWindowSize } from '@/desktop/window-size';
import { useSize } from '@/hooks/use-size';
import { cn } from '@/lib/utils';
import { findPane, type PaneNode, resetDivider, resizeSplit, type Split, type SplitDirection } from '@/panes/layout';
import { minNodeSize, minPaneSizeIn } from '@/panes/pane-size';
import { SplitPanel, type SplitPanelAnimation } from '@/panes/split-panel';
import { closingSplit, percentages, type SplitAnimation, splitAnimation } from '@/panes/split-animation';
import { useZoomAnimation } from '@/panes/zoom-animation';

/** How close a divider is dropped to an even split for it to snap there, in pixels */
const snapDistance = 8;

export function DashboardPanes({ dashboard }: { dashboard: Dashboard }) {
	const { layout } = dashboard;
	const focusedPaneId = getFocusedPane(dashboard).id;
	const zoomedPaneId = getZoomedPane(dashboard)?.id;
	const container = useRef<HTMLDivElement>(null);
	const size = useSize(container);
	const zoom = useZoomAnimation(container, layout, zoomedPaneId);
	const zooming = zoom !== undefined;

	useMinWindowSize(layout, size);
	const minPaneSizes = size && {
		row: minPaneSizeIn(layout, 'row', size.width),
		column: minPaneSizeIn(layout, 'column', size.height),
	};

	// Entries dropped on a widget or one of its entries, from the entry browser or another widget
	useDragDropMonitor<
		EntryDragData | EntryDropData | EntrySectionDropData,
		Draggable<EntryDragData>,
		Droppable<EntryDropData | EntrySectionDropData>
	>({
		onDragEnd: ({ operation, canceled }) => {
			const { source, target } = operation;
			// Entries dropped in the entry browser are moved between its sections instead
			if (!canceled && source?.type === entryDragType && target && 'paneId' in target.data) {
				const { name, paneId, bindingId } = source.data;
				const from = paneId !== undefined && bindingId !== undefined ? { paneId, bindingId } : undefined;
				dropDashboardEntry(dashboard.id, { name, from }, target.data);
			}
		},
	});

	return (
		<div ref={container} className="h-full" data-zooming={zooming || undefined}>
			<PaneNodeView
				dashboardId={dashboard.id}
				dashboardLayout={layout}
				focusedPaneId={focusedPaneId}
				zoomedPaneId={zoomedPaneId}
				hiddenBy={zooming ? undefined : zoomedPaneId}
				zooming={zooming}
				zoomFillingPaneId={zoom?.zoomingIn === true ? zoom.paneId : undefined}
				minPaneSizes={minPaneSizes}
				node={layout}
				root
				topLeft
			/>
		</div>
	);
}

type NodeProps = PaneNodeProps & {
	/** The zoomed pane once it fills the dashboard, which hides the panes in the other children of its splits */
	hiddenBy: string | undefined;
	/** Whether a zoom is animating, which lets the panes move outside their splits */
	zooming: boolean;
	/** In pixels, the smallest each pane can be along each direction, `undefined` until the dashboard's measured */
	minPaneSizes: Record<SplitDirection, number> | undefined;
};

function PaneNodeView({ node, root = false, ...props }: NodeProps & { node: PaneNode; root?: boolean }) {
	const { zoomedPaneId } = props;
	const [previous, setPrevious] = useState({ node, zoomedPaneId });
	const [animation, setAnimation] = useState<SplitAnimation>();
	if (previous.node !== node || previous.zoomedPaneId !== zoomedPaneId) {
		setPrevious({ node, zoomedPaneId });
		const changed = previous.node === node ? undefined : splitAnimation(previous.node, node, props.dashboardLayout);
		// Closing a pane restores the zoomed pane's dashboard, which already animates the other panes back in
		if (changed && !(changed.kind === 'close' && previous.zoomedPaneId !== undefined)) {
			setAnimation(changed);
		}
	}

	if (animation?.kind === 'close') {
		return (
			<SplitView
				key={animation.split.id}
				{...props}
				split={closingSplit(animation, node)}
				animation={animation}
				onAnimationEnd={() => setAnimation(undefined)}
			/>
		);
	}

	return node.kind === 'pane' ? (
		// Closing the only pane does nothing unless there's a widget to remove
		<PaneView {...props} pane={node} closable={!root || node.widget !== undefined} />
	) : (
		// Keyed so a split that takes another's place reads its own sizes
		<SplitView
			key={node.id}
			{...props}
			split={node}
			animation={animation?.split.id === node.id ? animation : undefined}
			onAnimationEnd={() => setAnimation(undefined)}
		/>
	);
}

/** In pixels, the smallest a child of a split can be for each of its panes to be at least `paneSize` along it */
function minSize(child: PaneNode, direction: SplitDirection, paneSize: number | undefined): number {
	return paneSize === undefined ? 0 : minNodeSize(child, direction, paneSize);
}

function SplitView({
	split,
	animation,
	onAnimationEnd,
	minPaneSizes,
	...props
}: NodeProps & { split: Split; animation: SplitAnimation | undefined; onAnimationEnd: () => void }) {
	const { dashboardId, hiddenBy, zooming } = props;
	const row = split.direction === 'row';
	const groupRef = useGroupRef();
	const group = useRef<HTMLDivElement>(null);
	const groupSize = useSize(group);
	const extent = row ? groupSize?.width : groupSize?.height;
	const dividers = split.children.length - 1;
	// A child with a split inside needs room for its panes and the 1px dividers between them
	const paneSize = minPaneSizes?.[split.direction];
	const minSizes = split.children.map((child) => minSize(child, split.direction, paneSize));
	// Every child is as small as it can be, so the dividers can't move (within a pixel of rounding)
	const locked = extent !== undefined && extent - minSizes.reduce((sum, size) => sum + size, 0) - dividers < 1;
	// A child's smallest share of the split
	const minimum = useCallback(
		(child: PaneNode) =>
			extent === undefined ? 0 : minSize(child, split.direction, paneSize) / Math.max(extent - dividers, 1),
		[extent, dividers, split.direction, paneSize],
	);

	// The shares the children end at, a closing pane ends at nothing
	const targets = useMemo(
		() =>
			animation?.kind === 'close'
				? {
						...percentages(
							{ ...split, children: split.children.filter((child) => child.id !== animation.childId) },
							minimum,
						),
						[animation.childId]: 0,
					}
				: percentages(split, minimum),
		[split, animation, minimum],
	);
	const from = useMemo(() => animation && percentages(animation.split, minimum), [animation, minimum]);
	// The group's layout. A closing pane keeps its share there while CSS shrinks it away, since lowering its `minSize` so it
	// could reach nothing only reaches the group after this layout is fitted to the old one. The others end in the
	// proportions they have without it, which is all that shows once it's gone.
	const groupLayout = useMemo(() => {
		if (animation?.kind !== 'close') {
			return targets;
		}
		const kept = from?.[animation.childId] ?? 0;
		return Object.fromEntries(
			Object.entries(targets).map(([id, share]) => [
				id,
				id === animation.childId ? kept : (share * (100 - kept)) / 100,
			]),
		);
	}, [animation, from, targets]);
	const moving = animation ? split.children.findIndex((child) => child.id === animation.childId) : -1;

	const panelAnimation = (childId: string, index: number): SplitPanelAnimation | undefined => {
		if (!animation || !from) {
			return undefined;
		}

		const closing = animation.kind === 'close';
		const role = index === moving ? (closing ? 'leave' : 'enter') : 'stay';
		return {
			role,
			from: from[childId] ?? 0,
			closing,
			size: ((role === 'leave' ? from[childId] : targets[childId]) ?? 0) / 100,
			dividers: role === 'leave' ? animation.split.children.length - 1 : dividers - (closing ? 1 : 0),
			// The children before the moving one are pinned to their start, the ones after it to their end
			pin: index === moving ? (index === 0 ? 'end' : 'start') : index < moving ? 'start' : 'end',
		};
	};

	// The group only reads `defaultLayout` when it mounts, so new sizes are applied here, once it knows every child's panel
	const pendingLayout = useRef<Layout>(undefined);
	const applyLayout = useCallback(() => {
		const layout = pendingLayout.current;
		const current = groupRef.current?.getLayout();
		const ids = current && Object.keys(current);
		if (layout && ids?.length === Object.keys(layout).length && ids.every((id) => id in layout)) {
			pendingLayout.current = undefined;
			groupRef.current?.setLayout(layout);
		}
	}, [groupRef]);
	useLayoutEffect(() => {
		pendingLayout.current = groupLayout;
		applyLayout();
	}, [applyLayout, groupLayout]);

	// While a zoomed pane fills the dashboard, its splits only show the child it's in
	const zoomedHere = hiddenBy !== undefined && findPane(split, hiddenBy) !== undefined;

	return (
		<Group
			groupRef={groupRef}
			elementRef={group}
			orientation={row ? 'horizontal' : 'vertical'}
			defaultLayout={groupLayout}
			onLayoutChange={applyLayout}
			// Container units size the animating children, and panes move outside their splits while a zoom animates
			style={{ containerType: animation ? 'size' : undefined, overflow: zooming ? 'visible' : undefined }}
			// Called once a drag is released or a key is pressed, not on every pointer move
			onLayoutChanged={(panelLayout, { isUserInteraction, requestedLayout = panelLayout }) => {
				if (!isUserInteraction || animation || extent === undefined) {
					return;
				}

				const sizes = split.children.map((child) => (requestedLayout[child.id] ?? 0) / 100);
				updateLayout(dashboardId, (layout) =>
					resizeSplit(layout, split.id, sizes, snapDistance / Math.max(extent - dividers, 1)),
				);
			}}
		>
			{split.children.flatMap((child, index) => [
				index > 0 && (
					<Separator
						key={`${child.id}-separator`}
						aria-label="Resize panes"
						// Disabled dividers don't get the hover and active highlights, and the not-allowed cursor is replaced so they don't look interactive
						disabled={locked}
						style={locked ? { cursor: 'auto' } : undefined}
						// The library's 10px hit area is mostly outside the line, so the pseudo-element catches double-clicks there
						className={cn(
							'bg-border outline-none transition-colors focus-visible:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring',
							'relative z-10 after:absolute',
							zoomedHere && 'hidden',
							row ? 'w-px after:inset-y-0 after:-inset-x-[4.5px]' : 'h-px after:inset-x-0 after:-inset-y-[4.5px]',
						)}
						onDoubleClick={() => {
							if (!locked) {
								updateLayout(dashboardId, (layout) => resetDivider(layout, split.id, index - 1));
							}
						}}
					/>
				),
				<SplitPanel
					key={child.id}
					id={child.id}
					minSize={minSizes[index]}
					direction={split.direction}
					animation={panelAnimation(child.id, index)}
					hidden={zoomedHere && findPane(child, hiddenBy) === undefined}
					zooming={zooming}
					onAnimationEnd={(event) => {
						// Ignores animations inside the pane
						if (index === moving && event.target === event.currentTarget) {
							onAnimationEnd();
						}
					}}
				>
					<PaneNodeView {...props} minPaneSizes={minPaneSizes} topLeft={index === 0 && props.topLeft} node={child} />
				</SplitPanel>,
			])}
		</Group>
	);
}
