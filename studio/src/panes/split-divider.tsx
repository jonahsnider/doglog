import { useEffect, useRef } from 'react';
import { Separator } from 'react-resizable-panels';
import { updateLayout } from '@/dashboards/panes';
import { cn } from '@/lib/utils';
import { linkedDividers, resetLinked } from '@/panes/divider-snap';
import { resetDivider, type SplitDirection } from '@/panes/layout';

/** The hovered and dragged dividers with their states, and the dividers highlighted since dragging them moves those too */
let highlighted: { sources: HTMLElement[]; states: string[]; links: HTMLElement[] } = {
	sources: [],
	states: [],
	links: [],
};
/** Whether Alt is held, which leaves the other dividers out */
let altKey = false;

/**
 * Highlights the dividers that move with the ones the layout library shows as hovered or dragged in `dashboard`. Near
 * where dividers cross, it decides which ones the pointer is on, and can pick more than one.
 */
function highlightLinked(dashboard: Element | null, force = false) {
	const sources = Array.from(
		dashboard?.querySelectorAll<HTMLElement>('[data-separator="hover"], [data-separator="active"]') ?? [],
	);
	const states = sources.map((source) => source.dataset['separator'] ?? '');
	// They stay in line while dragged, but may be a frame behind, so they're found again once released
	if (
		!force &&
		states.join(',') === highlighted.states.join(',') &&
		sources.every((source, index) => source === highlighted.sources[index])
	) {
		return;
	}
	for (const link of highlighted.links) {
		delete link.dataset['linked'];
	}
	const links = new Set(altKey ? [] : sources.flatMap((source) => Array.from(linkedDividers(source))));
	for (const source of sources) {
		links.delete(source);
	}
	highlighted = { sources, states, links: Array.from(links) };
	for (const link of highlighted.links) {
		link.dataset['linked'] = '';
	}
}

// Read from every event, since a key released outside the window never reaches it
function updateAltKey(event: KeyboardEvent | PointerEvent) {
	const [source] = highlighted.sources;
	if (event.altKey !== altKey) {
		altKey = event.altKey;
		// A drag keeps the dividers it started with
		if (source && !highlighted.states.includes('active')) {
			highlightLinked(source.closest('[data-dashboard-panes]'), true);
		}
	}
}
for (const type of ['keydown', 'keyup', 'pointermove', 'pointerdown'] as const) {
	addEventListener(type, updateAltKey, true);
}

/** Highlights the dividers that move with `separator` while it's hovered or dragged */
function followSeparatorState(separator: HTMLElement): () => void {
	const dashboard = separator.closest('[data-dashboard-panes]');
	const observer = new MutationObserver(() => highlightLinked(dashboard));
	observer.observe(separator, { attributeFilter: ['data-separator'] });
	return () => {
		observer.disconnect();
		if (highlighted.sources.includes(separator)) {
			highlightLinked(null);
		}
	};
}

/**
 * The divider between two children of a split. Dividers in line with it move with it (see `linkedDividers()`), unless
 * Alt is held.
 */
export function SplitDivider({
	dashboardId,
	splitId,
	index,
	direction,
	locked,
	hidden,
}: {
	dashboardId: string;
	splitId: string;
	/** Of the child before it */
	index: number;
	direction: SplitDirection;
	/** Every child is as small as it can be, so it can't move */
	locked: boolean;
	/** Hidden by a zoomed pane */
	hidden: boolean;
}) {
	const row = direction === 'row';
	const element = useRef<HTMLDivElement>(null);
	useEffect(() => (element.current ? followSeparatorState(element.current) : undefined), []);
	return (
		<Separator
			elementRef={element}
			aria-label="Resize panes"
			// Disabled dividers don't get the hover and active highlights, and the not-allowed cursor is replaced so they don't look interactive
			disabled={locked}
			style={locked ? { cursor: 'auto' } : undefined}
			// The gap between panes, with a line in the middle while it's hovered or dragged. The `after` pseudo-element
			// widens it to the library's 10px hit area so double-clicks land on it.
			className={cn(
				'relative z-10 outline-none before:absolute before:rounded-full before:transition-colors focus-visible:before:bg-ring data-[separator=active]:before:bg-ring data-[separator=hover]:before:bg-ring data-snap-guide:before:bg-ring data-linked:before:bg-ring',
				'after:absolute',
				hidden && 'hidden',
				row
					? 'w-1.5 before:inset-y-1 before:inset-x-0.5 after:inset-y-0 after:-inset-x-0.5'
					: 'h-1.5 before:inset-x-1 before:inset-y-0.5 after:inset-x-0 after:-inset-y-0.5',
			)}
			onDoubleClick={(event) => {
				if (!locked) {
					const resetLinks = event.altKey ? undefined : resetLinked(event.currentTarget);
					updateLayout(dashboardId, (layout) => {
						const reset = resetDivider(layout, splitId, index);
						return resetLinks ? resetLinks(reset) : reset;
					});
				}
			}}
		/>
	);
}
