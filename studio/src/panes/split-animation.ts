import { type HTMLAttributes, useState } from 'react';
import { findPane, type PaneNode, type Split } from '@/panes/layout';

export type SplitSide = 'first' | 'second';

/** A split's side growing in from nothing when it's opened or restored, shrinking away when it's closed, or hidden by a zoomed pane */
export type SplitAnimation =
	| { kind: 'open'; side: SplitSide }
	| { kind: 'close'; side: SplitSide; split: Split }
	| { kind: 'hide'; side: SplitSide };

/** How the layout changed from `previous` to `node` at the same place in it, like Rex animating its splits */
export function splitAnimation(previous: PaneNode, node: PaneNode, layout: PaneNode): SplitAnimation | undefined {
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

/** The side of a split hidden while a pane on its other side is zoomed */
function hiddenSplitSide(split: Split, zoomedPaneId: string | undefined): SplitSide | undefined {
	if (zoomedPaneId === undefined) {
		return undefined;
	}

	if (findPane(split.first, zoomedPaneId)) {
		return 'second';
	}

	return findPane(split.second, zoomedPaneId) ? 'first' : undefined;
}

/**
 * Attributes for a split's side that play the keyframes in `index.css`, which animate its flex-grow (set by the group to
 * its percentage of the split). `instant` holds the hidden side in place without animating, for a dashboard opened zoomed.
 */
export function splitPanelAnimation(
	side: SplitSide,
	playing: SplitAnimation | undefined,
	hiddenSide: SplitSide | undefined,
	instant: boolean,
	onEnd: (animation: SplitAnimation) => void,
): HTMLAttributes<HTMLDivElement> & { 'data-split-animation'?: string; 'data-split-instant'?: boolean } {
	if (!playing) {
		// The hidden side is held at the end of its animation
		return hiddenSide === undefined
			? {}
			: {
					'data-split-animation': side === hiddenSide ? 'close' : 'fill',
					'data-split-instant': instant || undefined,
					inert: side === hiddenSide,
				};
	}

	if (playing.side !== side) {
		return { 'data-split-animation': playing.kind === 'open' ? 'make-room' : 'fill' };
	}

	return {
		'data-split-animation': playing.kind === 'open' ? 'open' : 'close',
		inert: playing.kind !== 'open',
		onAnimationEnd: (event) => {
			// Ignores animations inside the pane
			if (event.target === event.currentTarget) {
				onEnd(playing);
			}
		},
	};
}

/**
 * While a pane is zoomed, every split above it hides its other side. `zoomAnimation` hides it or restores it, and is
 * `undefined` while hidden if the split mounted that way, so it's hidden without animating.
 */
export function useZoomAnimation(split: Split, zoomedPaneId: string | undefined) {
	const hiddenSide = hiddenSplitSide(split, zoomedPaneId);
	const [previousHiddenSide, setPreviousHiddenSide] = useState(hiddenSide);
	const [zoomAnimation, setZoomAnimation] = useState<SplitAnimation>();
	if (previousHiddenSide !== hiddenSide) {
		setPreviousHiddenSide(hiddenSide);
		setZoomAnimation(
			hiddenSide
				? { kind: 'hide', side: hiddenSide }
				: previousHiddenSide && { kind: 'open', side: previousHiddenSide },
		);
	}

	return { hiddenSide, zoomAnimation };
}
