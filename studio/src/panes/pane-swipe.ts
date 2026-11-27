import { type PanGestureEvent, usePanGesture } from '@astryxdesign/core/hooks';
import { createContext, type RefObject, use, useRef } from 'react';

// In the phone layout, swiping a pane's header switches panes. Headers are rendered apart from `PhonePanes`, so their
// swipes reach it through `PaneSwipeContext`.

export type SwipeHandler = (event: PanGestureEvent) => void;

/** Swipes on pane headers, from `createSwipes()`, or `undefined` outside the phone layout */
export const PaneSwipeContext = createContext<SwipeHandler | undefined>(undefined);

/** Passes the swipes `emit` gets to the handler subscribed last */
export function createSwipes() {
	let handler: SwipeHandler | undefined;
	return {
		emit: (event: PanGestureEvent) => handler?.(event),
		/** Returns a function that unsubscribes */
		subscribe: (next: SwipeHandler) => {
			handler = next;
			return () => {
				if (handler === next) {
					handler = undefined;
				}
			};
		},
	};
}

export type Swipes = ReturnType<typeof createSwipes>;

/** Stands in for the swipe area outside the phone layout, so no pan is attached */
const noSwipeArea = { current: null };

/** The element whose sideways swipes switch panes in the phone layout, a pane's header */
export function usePaneSwipeArea(): RefObject<HTMLDivElement | null> {
	const swipe = use(PaneSwipeContext);
	const area = useRef<HTMLDivElement>(null);
	usePanGesture(swipe ? area : noSwipeArea, { axis: 'x', onPan: (event) => swipe?.(event) });
	return area;
}
