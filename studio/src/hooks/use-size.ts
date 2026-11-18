import { type RefObject, useEffect, useState } from 'react';

export type Size = { width: number; height: number };

/** An element's size in pixels, `undefined` until it's measured */
export function useSize(ref: RefObject<HTMLElement | null>): Size | undefined {
	const [size, setSize] = useState<Size>();

	useEffect(() => {
		const element = ref.current!;
		const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	return size;
}
