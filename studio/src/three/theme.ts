import { useEffect, useState } from 'react';

let probe: CanvasRenderingContext2D | null | undefined;

/**
 * A CSS color as `#rrggbb`, which three.js understands, ex. for `var(--md-primary)`. Theme colors use color spaces and
 * functions three.js can't parse, so the color is resolved by the browser and drawn to a pixel to read it back.
 */
function resolveColor(css: string): string {
	const element = document.createElement('span');
	element.style.color = css;
	document.body.append(element);
	const computed = getComputedStyle(element).color;
	element.remove();

	probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	if (!probe) {
		return '#808080';
	}
	// Translucent colors are blended over the page's background, like they'd be drawn
	probe.fillStyle = getComputedStyle(document.body).backgroundColor;
	probe.fillRect(0, 0, 1, 1);
	probe.fillStyle = computed;
	probe.fillRect(0, 0, 1, 1);
	const [red = 0, green = 0, blue = 0] = probe.getImageData(0, 0, 1, 1).data;
	return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** A CSS color resolved for three.js, ex. `var(--md-outline-variant)`, updated when the theme changes */
export function useThemeColor(css: string): string {
	const [resolved, setResolved] = useState(() => resolveColor(css));

	useEffect(() => {
		const update = () => setResolved(resolveColor(css));
		update();
		// The theme changes the `dark` class on the root, and the generated colors in a style element in the head
		const observer = new MutationObserver(update);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
		observer.observe(document.head, { childList: true, subtree: true, characterData: true });
		return () => observer.disconnect();
	}, [css]);

	return resolved;
}
