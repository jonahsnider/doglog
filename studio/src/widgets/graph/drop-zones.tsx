import {
	colorVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragOperation, useDroppable } from '@dnd-kit/react';
import * as stylex from '@stylexjs/stylex';
import { use } from 'react';
import { getEntry } from '@/data/data-store';
import {
	type EntryDragData,
	type EntryDragItem,
	type EntryDropData,
	entryDragType,
	isEntryDrag,
	WidgetBindingsContext,
} from '@/entries/drag';
import { maxWidgetEntries } from '@/widgets/bindings';
import { type GraphSection, graphRoles, graphSection } from '@/widgets/graph/roles';

const styles = stylex.create({
	zones: {
		pointerEvents: 'none',
		position: 'absolute',
		inset: 0,
		zIndex: 20,
		display: 'flex',
		flexDirection: 'column',
		padding: spacingVars['--spacing-1'],
	},
	row: {
		display: 'flex',
	},
	fill: {
		flex: 1,
	},
	axes: {
		minHeight: 0,
	},
	zone: {
		margin: spacingVars['--spacing-1'],
		display: 'flex',
		minWidth: 0,
		flex: 1,
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-surface'],
	},
	label: {
		display: 'flex',
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: radiusVars['--radius-element'],
		borderWidth: 2,
		borderStyle: 'dashed',
		borderColor: colorVars['--color-border-emphasized'],
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: colorVars['--color-text-secondary'],
	},
	active: {
		borderStyle: 'solid',
		borderColor: colorVars['--color-accent'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 10%, transparent)`,
		color: colorVars['--color-text-accent'],
	},
});

/**
 * The sections a dragged entry can be shown in, ex. strings can only be bands. Rows showing a struct's only field go
 * where the field can, see `droppedEntryName()`.
 */
function sectionsOf({ name, field }: EntryDragItem): GraphSection[] {
	for (const candidate of [name, field]) {
		const entry = candidate === undefined ? undefined : getEntry(candidate);
		const roles = entry ? graphRoles(entry) : [];
		if (roles.length > 0) {
			return roles.map((role) => graphSection(role));
		}
	}
	return [];
}

/**
 * Like splitting a pane, dragging an entry over the graph, or one of its own entries anywhere, covers it with zones to
 * drop the entry on: the left and right halves for its axes, and the bands at the bottom
 */
export function DropZones({ bandsHeight }: { bandsHeight: number }) {
	const widget = use(WidgetBindingsContext);
	const paneId = widget?.paneId ?? '';
	const { source, target } = useDragOperation<
		EntryDragData | EntryDropData,
		Draggable<EntryDragData>,
		Droppable<EntryDropData>
	>();
	const drop = target?.data;
	// A group can mix entries that belong on different axes or bands, so let the graph infer each role.
	const shown =
		isEntryDrag(source) &&
		!source.data.group &&
		(source.data.paneId === paneId || (drop?.paneId === paneId && (widget?.bindings.length ?? 0) < maxWidgetEntries));
	if (!shown) {
		return undefined;
	}
	const sections = sectionsOf(source.data);
	// Dropping on the graph's entries also moves the dragged entry to their section
	const over = drop?.paneId === paneId ? drop.role : undefined;
	const zone = (section: GraphSection, label: string) =>
		sections.includes(section) && (
			<Zone key={section} paneId={paneId} section={section} label={label} active={over === section} />
		);
	const plottable = sections.includes('left');
	return (
		<div {...stylex.props(styles.zones)}>
			{plottable && (
				<div {...stylex.props(styles.row, styles.fill, styles.axes)}>
					{zone('left', 'Left axis')}
					{zone('right', 'Right axis')}
				</div>
			)}
			<div {...stylex.props(styles.row, !plottable && styles.fill)} style={{ height: Math.max(bandsHeight, 48) }}>
				{zone('discrete', 'Bands')}
			</div>
		</div>
	);
}

function Zone({
	paneId,
	section,
	label,
	active,
}: {
	paneId: string;
	section: GraphSection;
	label: string;
	active: boolean;
}) {
	const { ref } = useDroppable<EntryDropData>({
		id: `${paneId}:${section}`,
		accept: (source) => {
			const { name, field, group } = source.data;
			return (
				source.type === entryDragType &&
				group === undefined &&
				sectionsOf({ name: String(name), field: typeof field === 'string' ? field : undefined }).includes(section)
			);
		},
		// Above the widget's own drop target, below its entries, which take the dropped entry's place among them
		collisionPriority: 2,
		data: { paneId, role: section },
	});
	return (
		<div ref={ref} {...stylex.props(styles.zone)}>
			<div {...stylex.props(styles.label, active && styles.active)}>{label}</div>
		</div>
	);
}
