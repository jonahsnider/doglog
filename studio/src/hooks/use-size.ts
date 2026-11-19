import { type RefObject, useEffect, useState } from 'react';

export type Size = { width: number; height: number };

/** An element's size in pixels, `undefined` until it's measured */
export function useSize(ref: RefObject<HTMLElement | null>): Size | undefined {
	const [size, setSize] = useState<Size>();

	useEffect(() => {
		const element = ref.current!;
		const observer = new ResizeObserver(() => {
			const { clientWidth: width, clientHeight: height } = element;
			setSize((previous) => (previous?.width === width && previous.height === height ? previous : { width, height }));
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	return size;
}
