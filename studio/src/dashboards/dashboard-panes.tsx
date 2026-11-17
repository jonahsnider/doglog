import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor } from '@dnd-kit/react';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { Group, Separator, useGroupRef } from 'react-resizable-panels';
import { PaneView, type PaneNodeProps } from '@/panes/pane-view';
import { dropDashboardEntry, getFocusedPane, getZoomedPane, updateLayout } from '@/dashboards/panes';
import type { Dashboard } from '@/dashboards/dashboards';
import { type EntryDragData, type EntryDropData, type EntrySectionDropData, entryDragType } from '@/entries/drag';
import { cn } from '@/lib/utils';
import { type PaneNode, panesAlong, resizeSplit, type Split } from '@/panes/layout';
import { SplitPanel } from '@/panes/split-panel';
import {
	useZoomAnimation,
	splitPanelAnimation,
	type SplitAnimation,
	splitAnimation,
	type SplitSide,
} from '@/panes/split-animation';

declare module 'react' {
	interface CSSProperties {
		/** The size a side of a split had when it started shrinking away, read by the `split-close` keyframes in `index.css` */
		'--split-leaving-size'?: string;
	}
}

type Size = { width: number; height: number };

/** An element's size in pixels, `undefined` until it's measured */
function useSize(ref: RefObject<HTMLElement | null>) {
	const [size, setSize] = useState<Size>();

	useEffect(() => {
		const element = ref.current!;
		const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	return size;
}

export function DashboardPanes({ dashboard }: { dashboard: Dashboard }) {
	const { layout } = dashboard;
	const focusedPaneId = getFocusedPane(dashboard).id;
	const container = useRef<HTMLDivElement>(null);
	const size = useSize(container);

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
		<div ref={container} className="h-full">
			<PaneNodeView
				dashboardId={dashboard.id}
				dashboardLayout={layout}
				focusedPaneId={focusedPaneId}
				zoomedPaneId={getZoomedPane(dashboard)?.id}
				dashboardSize={size}
				node={layout}
				root
				topLeft
			/>
		</div>
	);
}

type NodeProps = PaneNodeProps & {
	/** In pixels, `undefined` until it's measured */
	dashboardSize: Size | undefined;
};

function PaneNodeView({ node, root = false, dashboardSize, ...props }: NodeProps & { node: PaneNode; root?: boolean }) {
	const { zoomedPaneId } = props;
	const [previous, setPrevious] = useState({ node, zoomedPaneId });
	const [animation, setAnimation] = useState<SplitAnimation>();
	if (previous.node !== node || previous.zoomedPaneId !== zoomedPaneId) {
		setPrevious({ node, zoomedPaneId });
		if (previous.node.id !== node.id) {
			const changed = splitAnimation(previous.node, node, props.dashboardLayout);
			// Closing a pane restores the zoomed pane's dashboard, which already animates the other panes back in
			setAnimation(changed?.kind === 'close' && previous.zoomedPaneId !== undefined ? undefined : changed);
		}
	}

	if (animation?.kind === 'close') {
		// The closed pane is kept until it has shrunk away, beside the latest version of the node taking its place
		const { split } = animation;
		return (
			<SplitView
				key={split.id}
				{...props}
				dashboardSize={dashboardSize}
				split={animation.side === 'first' ? { ...split, second: node } : { ...split, first: node }}
				animation={animation}
				onClosed={() => setAnimation(undefined)}
			/>
		);
	}

	return node.kind === 'pane' ? (
		// Closing the only pane does nothing unless there's a widget to remove
		<PaneView {...props} pane={node} closable={!root || node.widget !== undefined} />
	) : (
		// Keyed so a split that takes another's place reads its own saved ratio
		<SplitView key={node.id} {...props} dashboardSize={dashboardSize} split={node} animation={animation} />
	);
}

/**
 * In pixels, the size the side shrinking away in `playing` had when it started. A zoom changes the size of the splits
 * around the zoomed pane right away, so the side leaving each of them is measured against the size from before.
 */
function useLeavingSize(split: Split, playing: SplitAnimation | undefined, groupSize: Size | undefined) {
	const [started, setStarted] = useState({ playing, groupSize });
	if (started.playing !== playing) {
		setStarted({ playing, groupSize });
	}

	const extent = split.direction === 'row' ? started.groupSize?.width : started.groupSize?.height;
	if (!playing || playing.kind === 'open' || extent === undefined) {
		return undefined;
	}

	return (extent - 1) * (playing.side === 'first' ? split.ratio : 1 - split.ratio);
}

function SplitView({
	split,
	dashboardSize,
	animation,
	onClosed,
	...props
}: NodeProps & { split: Split; animation?: SplitAnimation | undefined; onClosed?: () => void }) {
	const { dashboardId } = props;
	const row = split.direction === 'row';
	const firstId = `${split.id}-first`;
	const secondId = `${split.id}-second`;
	const groupRef = useGroupRef();
	const group = useRef<HTMLDivElement>(null);
	const groupSize = useSize(group);
	// Keep every pane at least a quarter of the dashboard, so a side with a split inside needs room for its panes and the 1px dividers between them
	const dashboardExtent = row ? dashboardSize?.width : dashboardSize?.height;
	const paneSize = dashboardExtent === undefined ? undefined : (dashboardExtent - 3) / 4;
	const minSize = (node: PaneNode) => {
		const panes = panesAlong(node, split.direction);
		return paneSize === undefined ? undefined : paneSize * panes + panes - 1;
	};
	const firstMinSize = minSize(split.first);
	const secondMinSize = minSize(split.second);
	// Both sides are as small as they can be, so the divider can't move (within a pixel of rounding)
	const locked =
		groupSize !== undefined &&
		firstMinSize !== undefined &&
		secondMinSize !== undefined &&
		(row ? groupSize.width : groupSize.height) - firstMinSize - secondMinSize - 1 < 1;

	const { hiddenSide, zoomAnimation } = useZoomAnimation(split, props.zoomedPaneId);

	// Kept so they don't play again, ex. when a pane is closed in a split that animated opening
	const [finished, setFinished] = useState<readonly SplitAnimation[]>([]);
	const playing = [animation, zoomAnimation].find((other) => other !== undefined && !finished.includes(other));
	const leavingSize = useLeavingSize(split, playing, groupSize);

	const animationProps = (side: SplitSide) =>
		splitPanelAnimation(side, playing, hiddenSide, zoomAnimation === undefined, (ended) =>
			ended.kind === 'close' ? onClosed?.() : setFinished((animations) => [...animations, ended]),
		);

	const panel = (side: SplitSide, panelMinSize: number | undefined, children: ReactNode) => {
		const sliding = playing?.side === side || hiddenSide === side;
		return (
			<SplitPanel
				id={side === 'first' ? firstId : secondId}
				minSize={panelMinSize}
				direction={split.direction}
				side={side}
				ratio={side === 'first' ? split.ratio : 1 - split.ratio}
				sliding={sliding}
				staying={sliding || !playing ? undefined : playing.kind === 'open' ? 'make-room' : 'fill'}
				leavingSize={playing?.side === side ? leavingSize : undefined}
				contentHidden={sliding && !playing}
				{...animationProps(side)}
			>
				{children}
			</SplitPanel>
		);
	};

	// The group only reads `defaultLayout` when it mounts, so a ratio changed by undo or redo is applied here
	useEffect(() => {
		groupRef.current?.setLayout({ [firstId]: split.ratio * 100, [secondId]: (1 - split.ratio) * 100 });
	}, [groupRef, firstId, secondId, split.ratio]);

	return (
		<Group
			groupRef={groupRef}
			elementRef={group}
			orientation={row ? 'horizontal' : 'vertical'}
			defaultLayout={{ [firstId]: split.ratio * 100, [secondId]: (1 - split.ratio) * 100 }}
			// For the animated pane's container units
			style={
				playing || hiddenSide
					? {
							containerType: 'size',
							...(leavingSize !== undefined && { '--split-leaving-size': `${leavingSize}px` }),
						}
					: undefined
			}
			// Called once a drag is released or a key is pressed, not on every pointer move
			onLayoutChanged={(panelLayout, { isUserInteraction, requestedLayout = panelLayout }) => {
				const size = requestedLayout[firstId];
				if (isUserInteraction && size !== undefined) {
					updateLayout(dashboardId, (layout) => resizeSplit(layout, split.id, size / 100));
				}
			}}
		>
			{panel('first', firstMinSize, <PaneNodeView {...props} dashboardSize={dashboardSize} node={split.first} />)}
			<Separator
				aria-label="Resize panes"
				// Disabled dividers don't get the hover and active highlights, and the not-allowed cursor is replaced so they don't look interactive
				disabled={locked}
				style={locked ? { cursor: 'auto' } : undefined}
				// The library's 10px hit area is mostly outside the line, so the pseudo-element catches double-clicks there
				className={cn(
					'bg-border outline-none transition-colors focus-visible:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring',
					'relative z-10 after:absolute',
					hiddenSide && 'hidden',
					row ? 'w-px after:inset-y-0 after:-inset-x-[4.5px]' : 'h-px after:inset-x-0 after:-inset-y-[4.5px]',
				)}
				onDoubleClick={() => {
					if (locked) {
						return;
					}

					groupRef.current?.setLayout({ [firstId]: 50, [secondId]: 50 });
					updateLayout(dashboardId, (layout) => resizeSplit(layout, split.id, 0.5));
				}}
			/>
			{panel(
				'second',
				secondMinSize,
				<PaneNodeView {...props} dashboardSize={dashboardSize} topLeft={false} node={split.second} />,
			)}
		</Group>
	);
}
