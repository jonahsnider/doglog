import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor } from '@dnd-kit/react';
import { useReducedMotion } from 'motion/react';
import { type HTMLAttributes, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { Group, Panel, Separator, useGroupRef } from 'react-resizable-panels';
import { PaneView, type PaneNodeProps } from '@/panes/pane-view';
import { dropDashboardEntry, getFocusedPane, updateLayout } from '@/dashboards/panes';
import type { Dashboard } from '@/dashboards/dashboards';
import { type EntryDragData, type EntryDropData, type EntrySectionDropData, entryDragType } from '@/entries/drag';
import { cn } from '@/lib/utils';
import { findPane, type PaneNode, panesAlong, resizeSplit, type Split, type SplitDirection } from '@/panes/layout';

/** Smallest pane width (`row`) and height (`column`) in pixels */
type MinPaneSize = Partial<Record<SplitDirection, number>>;

/** A quarter of the dashboard, leaving room for the dividers between 4 panes */
const quarter = (size: number | undefined) => (size === undefined ? undefined : (size - 3) / 4);

/** An element's size in pixels, `undefined` until it's measured */
function useSize(ref: RefObject<HTMLElement | null>) {
	const [size, setSize] = useState<{ width: number; height: number }>();

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
				minPaneSize={{ row: quarter(size?.width), column: quarter(size?.height) }}
				node={layout}
				root
				topLeft
			/>
		</div>
	);
}

type NodeProps = PaneNodeProps & { minPaneSize: MinPaneSize };

type SplitSide = 'first' | 'second';

/** A split's side growing in from nothing when it's opened, or shrinking away when it's closed */
type SplitAnimation = { kind: 'open'; side: SplitSide } | { kind: 'close'; side: SplitSide; split: Split };

/** How the layout changed from `previous` to `node` at the same place in it, like Rex animating its splits */
function splitAnimation(previous: PaneNode, node: PaneNode, layout: PaneNode): SplitAnimation | undefined {
	if (node.kind === 'split') {
		if (node.first.id === previous.id) {
			return { kind: 'open', side: 'second' };
		}

		if (node.second.id === previous.id) {
			return { kind: 'open', side: 'first' };
		}
	}

	if (previous.kind === 'split') {
		const side = previous.first.id === node.id ? 'second' : previous.second.id === node.id ? 'first' : undefined;
		const closed = side && previous[side];
		// A pane moved somewhere else in the layout is already shown there
		if (side && closed?.kind === 'pane' && !findPane(layout, closed.id)) {
			return { kind: 'close', side, split: previous };
		}
	}

	return undefined;
}

function PaneNodeView({ node, root = false, minPaneSize, ...props }: NodeProps & { node: PaneNode; root?: boolean }) {
	const reducedMotion = useReducedMotion() ?? false;
	const [previous, setPrevious] = useState(node);
	const [animation, setAnimation] = useState<SplitAnimation>();
	if (previous !== node) {
		setPrevious(node);
		if (previous.id !== node.id) {
			setAnimation(reducedMotion ? undefined : splitAnimation(previous, node, props.dashboardLayout));
		}
	}

	if (animation?.kind === 'close') {
		// The closed pane is kept until it has shrunk away, beside the latest version of the node taking its place
		const { split } = animation;
		return (
			<SplitView
				key={split.id}
				{...props}
				minPaneSize={minPaneSize}
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
		<SplitView key={node.id} {...props} minPaneSize={minPaneSize} split={node} animation={animation} />
	);
}

function SplitView({
	split,
	minPaneSize,
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
	const paneSize = minPaneSize[split.direction];
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

	// Kept until the next animation, which may play on this split when a pane in it is closed
	const [finished, setFinished] = useState<SplitAnimation>();
	const playing = animation === finished ? undefined : animation;

	// The keyframes in `index.css` animate the sides' flex-grow, which the group sets to their percentages of the split
	const animationProps = (side: SplitSide): HTMLAttributes<HTMLDivElement> & { 'data-split-animation'?: string } => {
		if (!playing) {
			return {};
		}

		if (playing.side !== side) {
			return { 'data-split-animation': playing.kind === 'open' ? 'make-room' : 'fill' };
		}

		return {
			'data-split-animation': playing.kind,
			inert: playing.kind === 'close',
			onAnimationEnd: (event) => {
				// Ignores animations inside the pane
				if (event.target !== event.currentTarget) {
					return;
				}

				if (playing.kind === 'close') {
					onClosed?.();
				} else {
					setFinished(playing);
				}
			},
		};
	};

	const panel = (side: SplitSide, panelMinSize: number | undefined, children: ReactNode) => {
		const animated = playing?.side === side;
		// The animated pane's content keeps the size it ends (or starts) at, measured against the group with container units.
		// It's clipped and pinned to the divider, so it slides in and out with it instead of reflowing every frame.
		const size = `calc((${row ? '100cqw' : '100cqh'} - 1px) * ${side === 'first' ? split.ratio : 1 - split.ratio})`;
		return (
			<Panel
				id={side === 'first' ? firstId : secondId}
				minSize={panelMinSize}
				style={
					animated
						? {
								overflow: 'hidden',
								display: 'flex',
								flexDirection: row ? 'row' : 'column',
								justifyContent: side === 'first' ? 'flex-end' : 'flex-start',
							}
						: { overflow: 'hidden' }
				}
				{...animationProps(side)}
			>
				<div
					className="size-full"
					style={animated ? { flex: 'none', ...(row ? { width: size } : { height: size }) } : undefined}
				>
					{children}
				</div>
			</Panel>
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
			style={playing ? { containerType: 'size' } : undefined}
			// Called once a drag is released or a key is pressed, not on every pointer move
			onLayoutChanged={(panelLayout, { isUserInteraction, requestedLayout = panelLayout }) => {
				const size = requestedLayout[firstId];
				if (isUserInteraction && size !== undefined) {
					updateLayout(dashboardId, (layout) => resizeSplit(layout, split.id, size / 100));
				}
			}}
		>
			{panel('first', firstMinSize, <PaneNodeView {...props} minPaneSize={minPaneSize} node={split.first} />)}
			<Separator
				aria-label="Resize panes"
				// Disabled dividers don't get the hover and active highlights, and the not-allowed cursor is replaced so they don't look interactive
				disabled={locked}
				style={locked ? { cursor: 'auto' } : undefined}
				// The library's 10px hit area is mostly outside the line, so the pseudo-element catches double-clicks there
				className={cn(
					'bg-border outline-none transition-colors focus-visible:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring',
					'relative z-10 after:absolute',
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
				<PaneNodeView {...props} minPaneSize={minPaneSize} topLeft={false} node={split.second} />,
			)}
		</Group>
	);
}
