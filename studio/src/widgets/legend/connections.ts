import { canConnect, type WidgetBinding } from '@/widgets/widget-type';

/** Height of each row of a vertical legend, so connections can be drawn between rows without measuring them */
export const rowHeight = 24;
/** Space between the handles and the first lane, and between lanes */
export const laneGap = 8;
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

/** Each source gets its own lane, the ones spanning the fewest rows nearest the handles so links cross less */
export function assignLanes(connections: readonly Connection[], rowOf: (id: string) => number): Map<string, number> {
	const spans = new Map<string, { min: number; max: number }>();
	for (const { sourceId, targetId } of connections) {
		const span = spans.get(sourceId) ?? { min: rowOf(sourceId), max: rowOf(sourceId) };
		spans.set(sourceId, { min: Math.min(span.min, rowOf(targetId)), max: Math.max(span.max, rowOf(targetId)) });
	}
	const sources = [...spans.entries()].toSorted(([, a], [, b]) => a.max - a.min - (b.max - b.min));
	return new Map(sources.map(([id], lane) => [id, lane]));
}

export const rowCenter = (row: number) => row * rowHeight + rowHeight / 2;

/** A connection being dragged out of a handle */
export type ConnectionDrag = {
	fromRow: number;
	/** The binding the connection would be drawn from, whose lane it's drawn in */
	sourceId: string;
	/** The row it would connect to if dropped, where it snaps to */
	toRow: number | undefined;
	/** The color of the connection it would make if dropped, the target's */
	color: string | undefined;
	/** The pointer's position in the viewport */
	x: number;
	y: number;
	/** The gutter's top left corner in the viewport, since the drag is drawn over the whole page */
	originX: number;
	originY: number;
};
