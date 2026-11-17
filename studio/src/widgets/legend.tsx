import type { ReactNode } from 'react';
import { EntryName } from '@/components/entry-name';
import { useEntryDrag } from '@/entry-drag';
import { cn } from '@/lib/utils';

export type LegendItem = {
	name: string;
	/** Swatch color, ignored when there's an `icon` */
	color?: string;
	icon?: ReactNode;
	/** Shown dimmed after the name */
	note?: string;
	dimmed: boolean;
	error?: string;
};

/** Names each bound entry of a drawn widget with its color, in wrapping rows or with one `vertical` item per row */
export function Legend({ items, vertical = false }: { items: LegendItem[]; vertical?: boolean }) {
	return (
		<ul className={cn('flex gap-x-3 gap-y-1 text-xs', vertical ? 'flex-col' : 'flex-wrap')}>
			{items.map((item) => (
				<LegendEntry key={item.name} item={item} vertical={vertical} />
			))}
		</ul>
	);
}

function LegendEntry({ item, vertical }: { item: LegendItem; vertical: boolean }) {
	const { ref } = useEntryDrag(item.name, { orientation: vertical ? 'vertical' : 'horizontal' });
	return (
		<li
			ref={ref}
			className={cn('flex min-w-0 cursor-grab items-center gap-1.5 select-none', item.dimmed && 'opacity-50')}
			// Right-clicking the item offers to remove its entry, middle-clicking removes it
			data-entry-name={item.name}
		>
			{item.icon ?? <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} />}
			<span className="truncate font-mono">
				<EntryName name={item.name} />
			</span>
			{item.note !== undefined && <span className="text-muted-foreground">{item.note}</span>}
			{item.error !== undefined && <span className="text-destructive-foreground">{item.error}</span>}
		</li>
	);
}
