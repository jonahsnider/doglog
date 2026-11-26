import { useCallback, useState } from 'react';
import { findPane, type Pane, type PaneNode, panes } from '@/panes/layout';

/** The elements panes are rendered into by ID, which `PaneSlot` moves into their places in the layout */
export type PaneHosts = {
	elements: Map<string, HTMLElement>;
	/** Lets go of closed panes once they're no longer in a slot, called after slots change */
	release: () => void;
};

/**
 * Panes are rendered into elements of their own, which are moved into their places in the layout, so they keep their
 * state when the splits around them change, ex. a 3D view keeps its WebGL context instead of showing nothing until a new
 * one draws. Returns the panes to render, which include closed ones while they're still shown, ex. as one shrinks away.
 */
export function usePaneHosts(layout: PaneNode): { hosts: PaneHosts; shown: Pane[] } {
	const [elements] = useState(() => new Map<string, HTMLElement>());
	// One state, so a pending release rebased onto an older layout recomputes the closed panes along with it
	const [tracked, setTracked] = useState<{ layout: PaneNode; leaving: Pane[] }>({ layout, leaving: [] });
	let { leaving } = tracked;
	if (tracked.layout !== layout) {
		const left = [...leaving, ...panes(tracked.layout)].filter((pane) => !findPane(layout, pane.id));
		leaving = left.filter((pane, index) => left.findIndex((other) => other.id === pane.id) === index);
		const kept = new Set([...panes(layout), ...leaving].map((pane) => pane.id));
		// The hosts of closed panes that were already let go
		for (const paneId of elements.keys()) {
			if (!kept.has(paneId)) {
				elements.delete(paneId);
			}
		}
		setTracked({ layout, leaving });
	}
	// oxlint-disable-next-line studio/no-manual-memo -- Effects depend on it, and `react-hooks/exhaustive-deps` can't tell that React Compiler memoizes it
	const release = useCallback(() => {
		setTracked((current) => {
			const kept = current.leaving.filter((pane) => elements.get(pane.id)?.isConnected === true);
			return kept.length === current.leaving.length ? current : { ...current, leaving: kept };
		});
	}, [elements]);
	return { hosts: { elements, release }, shown: [...panes(layout), ...leaving] };
}

/** The element a pane is rendered into */
export function hostOf({ elements }: PaneHosts, paneId: string): HTMLElement {
	let host = elements.get(paneId);
	if (!host) {
		host = document.createElement('div');
		host.style.display = 'contents';
		elements.set(paneId, host);
	}
	return host;
}
