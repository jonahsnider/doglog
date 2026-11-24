import { canConnect, type WidgetBinding } from '@/widgets/widget-type';

/** Height of each row of a vertical legend, so connections can be drawn between rows without measuring them */
export const rowHeight = 24;
/** Leave room between lanes for their hit areas and remove marks. */
export const laneGap = 12;
/** The handles' centers are this far left of the gutter */
export const handleInset = 6;

export type Connection = { sourceId: string; targetId: string; color: string | undefined };

/**
 * The source and target of connecting `from` to `to` by dragging, `undefined` if they can't be connected. Lines start at
 * single positions, so dragging from an array to a single pose connects the other way, like dragging a part to a robot.
 */
export function connectionBetween(
	from: WidgetBinding,
	to: WidgetBinding,
): { source: WidgetBinding; target: WidgetBinding } | undefined {
	if (from.id === to.id) {
		return undefined;
	}
	if (canConnect(from, to)) {
		return { source: from, target: to };
	}
	return canConnect(to, from) ? { source: to, target: from } : undefined;
}

/** Route short links first to avoid crossing their longer neighbors, and reuse lanes between disjoint spans. */
export function assignLanes(connections: readonly Connection[], rowOf: (id: string) => number) {
	const spans = connections.map((connection) => {
		const source = rowOf(connection.sourceId);
		const target = rowOf(connection.targetId);
		return { connection, min: Math.min(source, target), max: Math.max(source, target) };
	});
	spans.sort((a, b) => a.max - a.min - (b.max - b.min) || a.min - b.min);
	const occupied: (typeof spans)[] = [];
	const lanes = new Map<Connection, number>();
	for (const span of spans) {
		const free = occupied.findIndex((lane) => lane.every((other) => span.min > other.max || span.max < other.min));
		const lane = free === -1 ? occupied.length : free;
		(occupied[lane] ??= []).push(span);
		lanes.set(span.connection, lane);
	}
	return { lanes, count: occupied.length };
}

export const rowCenter = (row: number) => row * rowHeight + rowHeight / 2;

/** A connection being dragged out of a handle */
export type ConnectionDrag = {
	fromRow: number;
	/** The row it would connect to if dropped, where it snaps to */
	toRow: number | undefined;
	/** The connection it would make if dropped */
	over: Connection | undefined;
	/** The pointer's position in the viewport */
	x: number;
	y: number;
	/** The gutter's top left corner in the viewport, since the drag is drawn over the whole page */
	originX: number;
	originY: number;
};
