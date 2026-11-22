import { advance, useThree } from '@react-three/fiber';
import { useEffect } from 'react';

/**
 * Resizes and draws the scene in the same frame as its pane resizes. The canvas otherwise learns its size through React
 * a frame or two later, showing its old size clipped or stretched before it jumps to the new one. Cameras that keep
 * their view across sizes adjust in `useFrame`, which runs as it's drawn. Render it inside the scene's canvas.
 */
export function ResizeWithPane() {
	const get = useThree((state) => state.get);
	useEffect(() => {
		const container = get().gl.domElement.parentElement;
		if (!container) {
			return undefined;
		}
		// Runs after the browser lays out the page and before it paints
		const observer = new ResizeObserver(() => {
			const state = get();
			// Measured like the canvas measures itself, so its own update later doesn't change anything
			const { width, height, top, left } = container.getBoundingClientRect();
			if (width > 0 && height > 0 && (width !== state.size.width || height !== state.size.height)) {
				state.setSize(width, height, top, left);
				advance(performance.now(), false, state);
			}
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [get]);
	return null;
}
