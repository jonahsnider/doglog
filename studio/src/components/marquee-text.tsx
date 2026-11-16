import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Scroll speed in pixels per second */
const speed = 80;
/** How long to wait at each end before scrolling back, in milliseconds */
const pause = 500;

/** Truncates `children` to one line, and scrolls back and forth to show the rest while hovered */
export function MarqueeText({ className, children }: { className?: string; children: ReactNode }) {
	const ref = useRef<HTMLSpanElement>(null);
	const [hovered, setHovered] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!hovered || !element || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return undefined;
		}

		let position = 0;
		let direction = 1;
		let pausedUntil = performance.now() + pause;
		let previous = performance.now();
		let frame = requestAnimationFrame(function step(now) {
			// Measured every frame since the content can change size, ex. an entry name's prefix growing on hover
			const distance = element.scrollWidth - element.clientWidth;
			if (now >= pausedUntil) {
				position = Math.min(Math.max(position + (direction * speed * (now - previous)) / 1000, 0), distance);
				if (position === (direction === 1 ? distance : 0)) {
					direction = -direction;
					pausedUntil = now + pause;
				}
			}
			previous = now;
			element.scrollLeft = position;
			frame = requestAnimationFrame(step);
		});

		return () => {
			cancelAnimationFrame(frame);
			element.scrollLeft = 0;
		};
	}, [hovered]);

	return (
		<span
			ref={ref}
			// The ellipsis would cover the end of the text while it's scrolled into view
			className={cn('block overflow-hidden whitespace-nowrap', hovered ? 'text-clip' : 'text-ellipsis', className)}
			onPointerEnter={() => setHovered(true)}
			onPointerLeave={() => setHovered(false)}
		>
			{children}
		</span>
	);
}
