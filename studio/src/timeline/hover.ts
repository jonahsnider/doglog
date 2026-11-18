// The time hovered in the timeline bar or any graph, which they all mark
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';

const hoverStore = createAtom<number | undefined>(undefined);

export function getHoverTime(): number | undefined {
	return hoverStore.get();
}

export function useHoverTime(): number | undefined {
	return useSelector(hoverStore);
}

export function setHoverTime(time: number | undefined): void {
	if (hoverStore.get() !== time) {
		hoverStore.set(time);
	}
}

export function subscribeHover(listener: () => void): () => void {
	const { unsubscribe } = hoverStore.subscribe(() => listener());
	return unsubscribe;
}
