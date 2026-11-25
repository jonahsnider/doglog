import {
	colorVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragOperation } from '@dnd-kit/react';
import * as stylex from '@stylexjs/stylex';
import { getEntry } from '@/data/data-store';
import { formatEntryType } from '@/data/samples';
import {
	droppedEntryName,
	droppedGroupNames,
	type EntryDragData,
	type EntryDropData,
	isEntryDrag,
} from '@/entries/drag';
import { maxWidgetEntries, unboundEntryNames, widgetEntryLimitMessage } from '@/widgets/bindings';
import { acceptsDrop, type WidgetBinding, type WidgetType } from '@/widgets/widget-type';

type ReorderPosition = { left: number; top: number; width: number; height: number };

const styles = stylex.create({
	feedback: {
		pointerEvents: 'none',
		position: 'absolute',
		inset: spacingVars['--spacing-1'],
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacingVars['--spacing-4'],
		borderRadius: radiusVars['--radius-element'],
		borderWidth: 2,
		borderStyle: 'dashed',
		textAlign: 'center',
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		backdropFilter: 'blur(4px)',
	},
	accepted: {
		borderColor: colorVars['--color-accent'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 8%, transparent)`,
		color: colorVars['--color-text-primary'],
	},
	rejected: {
		borderColor: colorVars['--color-error'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-error']} 8%, transparent)`,
		color: colorVars['--color-text-error'],
	},
	reorder: {
		pointerEvents: 'none',
		position: 'fixed',
		zIndex: 10,
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-accent'],
	},
	reorderAt: (left: number, top: number, width: number, height: number) => ({
		left: `${left}px`,
		top: `${top}px`,
		width: `${width}px`,
		height: `${height}px`,
	}),
});

/** Shows where a dragged entry will go: a message over the widget about dropping it, or a line where it's reordered to */
export function DropFeedback({
	paneId,
	type,
	bindings,
}: {
	paneId: string;
	type: WidgetType;
	bindings: readonly WidgetBinding[];
}) {
	const { source, target } = useDragOperation<
		EntryDragData | EntryDropData,
		Draggable<EntryDragData>,
		Droppable<EntryDropData>
	>();
	const drop = target?.data;
	// Panes dragged over the widget show their own feedback
	const dragged = drop?.paneId === paneId && isEntryDrag(source) ? source.data : undefined;
	if (!dragged) {
		return undefined;
	}

	if (drop?.index !== undefined) {
		const from = bindings.findIndex((binding) => binding.id === dragged.bindingId);
		return <ReorderIndicator from={from} drop={drop} element={target?.element} />;
	}
	// Parts of a widget that set the dropped entry's role, ex. a graph's right axis, highlight themselves
	if (drop?.role !== undefined) {
		return undefined;
	}

	const { accepted, message } = entryDropFeedback(type, dragged, bindings);
	return <div {...stylex.props(styles.feedback, accepted ? styles.accepted : styles.rejected)}>{message}</div>;
}

function entryDropFeedback(type: WidgetType, dragged: EntryDragData, bindings: readonly WidgetBinding[]) {
	if (dragged.group) {
		const names = droppedGroupNames(type, dragged.group);
		const count = unboundEntryNames(bindings, names).length;
		if (count > 0 && bindings.length + count > maxWidgetEntries) {
			return { accepted: false, message: widgetEntryLimitMessage };
		}
		return {
			accepted: count > 0,
			message:
				count > 0
					? `Drop to add ${count} ${count === 1 ? 'entry' : 'entries'}`
					: names.length === 0
						? `${type.name} doesn't accept any entries in this group`
						: `${type.name} already shows all compatible entries in this group`,
		};
	}
	// A single entry can be bound again, ex. to draw a pose as a robot and a ghost
	const name = droppedEntryName(type, dragged);
	const entry = getEntry(name);
	const accepted = acceptsDrop(type, name, entry);
	if (accepted && type.optionFromEntry === undefined && bindings.length >= maxWidgetEntries) {
		return { accepted: false, message: widgetEntryLimitMessage };
	}
	return {
		accepted,
		message: accepted
			? `Drop to show ${name}`
			: entry
				? `${type.name} doesn't accept ${formatEntryType(entry.type)} entries`
				: `${type.name} doesn't accept ${name}`,
	};
}

function ReorderIndicator({
	from,
	drop,
	element,
}: {
	from: number;
	drop: EntryDropData;
	element: Element | undefined;
}) {
	const index = drop.index!;
	if (element === undefined || from === index) {
		return undefined;
	}

	// The dragged entry takes the hovered entry's position, so it goes after entries below it and before entries above it
	const after = from < index;
	const rect = element.getBoundingClientRect();
	// Fixed, so it's placed by the hovered element's viewport position no matter how the widget scrolls or nests it
	const position: ReorderPosition =
		drop.orientation === 'horizontal'
			? { left: (after ? rect.right : rect.left) - 1, top: rect.top, width: 2, height: rect.height }
			: { left: rect.left, top: (after ? rect.bottom : rect.top) - 1, width: rect.width, height: 2 };
	return (
		<div
			{...stylex.props(styles.reorder, styles.reorderAt(position.left, position.top, position.width, position.height))}
		/>
	);
}
