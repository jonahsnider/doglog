import { useBindingDrag } from '@/entries/drag';
import { EntryName } from '@/entries/entry-name';
import { bandHeight, bandTop, labelHeight, rowHeight } from '@/widgets/graph/bands';
import { NoData } from '@/widgets/no-data';
import type { WidgetBinding } from '@/widgets/widget-type';

/** A discrete entry's name above its bands, which are drawn on a canvas behind it */
export function BandRow({
	binding,
	row,
	insets,
}: {
	binding: WidgetBinding;
	row: number;
	insets: { left: number; right: number };
}) {
	const { ref, handleRef } = useBindingDrag(binding, { dropRole: 'discrete' });
	return (
		<div
			ref={ref}
			className="absolute text-xs"
			style={{ top: row * rowHeight, height: rowHeight, left: insets.left, right: insets.right }}
			// Right-clicking the row offers to remove its binding, middle-clicking removes it
			data-binding-id={binding.id}
		>
			<div className="flex max-w-full items-center gap-1.5 pt-0.5 leading-4" data-graph-label>
				{/* Dragged by the name, dragging the band pans. Numbers can be moved back to an axis from the context menu. */}
				<span ref={handleRef} className="min-w-0 cursor-grab truncate font-mono text-muted-foreground">
					<EntryName name={binding.name} />
				</span>
			</div>
			{!binding.entry && (
				<div className="flex items-center" style={{ height: bandHeight, marginTop: bandTop - labelHeight - 2 }}>
					<NoData />
				</div>
			)}
		</div>
	);
}
