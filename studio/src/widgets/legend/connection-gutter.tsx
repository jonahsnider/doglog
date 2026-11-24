// Connections between a vertical legend's bindings, drawn like a flowchart in a gutter to the right of its rows
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
	assignLanes,
	type Connection,
	type ConnectionDrag,
	laneGap,
	rowCenter,
	rowHeight,
	handleInset,
} from '@/widgets/legend/connections';

/** Links legend handles with right angles. Clicking a link's lane removes the link. */
export function ConnectionGutter({
	rows,
	connections,
	rowOf,
	hidden,
	hovered,
	onHover,
	onRemove,
	drag,
}: {
	rows: number;
	connections: readonly Connection[];
	rowOf: (id: string) => number;
	/** Whether a binding is hidden, which dims its links */
	hidden: (id: string) => boolean;
	hovered: Connection | undefined;
	onHover: (connection: Connection | undefined) => void;
	onRemove: (connection: Connection) => void;
	drag: ConnectionDrag | undefined;
}) {
	const { lanes, count } = assignLanes(connections, rowOf);
	const drop = drag?.over;
	const existing =
		drop &&
		connections.find(
			({ sourceId, targetId }) =>
				(sourceId === drop.sourceId && targetId === drop.targetId) ||
				(sourceId === drop.targetId && targetId === drop.sourceId),
		);
	// Route a snapped preview with the saved links, but keep the gutter width fixed under the pointer.
	const routed = drop && !existing ? assignLanes([...connections, drop], rowOf).lanes : lanes;
	const preview = existing ?? drop;
	const isHovered = ({ sourceId, targetId }: Connection) =>
		hovered?.sourceId === sourceId && hovered.targetId === targetId;
	const width = laneGap * (count + 1);
	return (
		<svg className="shrink-0 overflow-visible" width={width} height={rows * rowHeight} aria-hidden>
			{/* Draw the hovered link above any lines it crosses. */}
			{connections
				.toSorted((a, b) => Number(isHovered(a)) - Number(isHovered(b)))
				.map((connection) => {
					const { sourceId, targetId, color } = connection;
					const x = laneGap * (routed.get(connection)! + 1);
					const sourceY = rowCenter(rowOf(sourceId));
					const targetY = rowCenter(rowOf(targetId));
					const d = `M ${-handleInset} ${sourceY} H ${x} V ${targetY} H ${-handleInset}`;
					const hoveredLink = isHovered(connection);
					return (
						<g
							key={`${sourceId}-${targetId}`}
							className="pointer-events-auto cursor-pointer"
							opacity={hidden(sourceId) || hidden(targetId) ? 0.4 : undefined}
							onPointerEnter={() => onHover(connection)}
							onPointerLeave={() => onHover(undefined)}
							onClick={() => onRemove(connection)}
						>
							{/* Red with an X while hovered, since clicking removes it */}
							<path
								d={d}
								fill="none"
								stroke={hoveredLink ? undefined : color}
								className={cn('pointer-events-none', hoveredLink && 'stroke-destructive')}
								strokeWidth={hoveredLink ? 3 : 2}
								strokeLinejoin="round"
							/>
							{/* Only the vertical segment is clickable; links can share a horizontal segment. */}
							<line x1={x} x2={x} y1={sourceY} y2={targetY} stroke="transparent" strokeWidth={10} />
							{hoveredLink && <RemoveMark x={x} y={(sourceY + targetY) / 2} />}
						</g>
					);
				})}
			{drag && <DragPreview drag={drag} lane={(preview && routed.get(preview)) ?? count} />}
		</svg>
	);
}

/** An X in a circle on the middle of a hovered link's lane, fits in the space right of the last lane */
function RemoveMark({ x, y }: { x: number; y: number }) {
	return (
		<g className="stroke-destructive" strokeWidth={1.5} strokeLinecap="round">
			<circle cx={x} cy={y} r={5.5} className="fill-background" />
			<path d={`M ${x - 2} ${y - 2} L ${x + 2} ${y + 2} M ${x + 2} ${y - 2} L ${x - 2} ${y + 2}`} />
		</g>
	);
}

/**
 * The connection being dragged, shaped like the link it'll make: out to its lane, then to the pointer, or to the row it
 * would connect to. Drawn over the whole page, since it's dragged over the rest of the widget.
 */
function DragPreview({ drag, lane }: { drag: ConnectionDrag; lane: number }) {
	const handleX = drag.originX - handleInset;
	const laneX = drag.originX + laneGap * (lane + 1);
	const fromY = drag.originY + rowCenter(drag.fromRow);
	const d =
		drag.toRow === undefined
			? `M ${handleX} ${fromY} H ${Math.max(laneX, drag.x)} V ${drag.y} H ${drag.x}`
			: `M ${handleX} ${fromY} H ${laneX} V ${drag.originY + rowCenter(drag.toRow)} H ${handleX}`;
	return createPortal(
		// Doesn't block finding the row under the pointer when it's dropped
		<svg className="pointer-events-none fixed inset-0 z-50 size-full" aria-hidden>
			<path
				d={d}
				fill="none"
				stroke={drag.over?.color}
				className={cn(drag.toRow === undefined && 'stroke-foreground')}
				strokeWidth={2}
				strokeDasharray={drag.toRow === undefined ? '3 3' : undefined}
				strokeLinejoin="round"
			/>
		</svg>,
		document.body,
	);
}
