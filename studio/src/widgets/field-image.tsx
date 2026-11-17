import { cn } from '@/lib/utils';
import { aspectRatio, fieldBackground, image, pixelsPerMeterX, pixelsPerMeterY, view } from '@/widgets/field-geometry';
import type { Zoom } from '@/widgets/field-zoom';
// Rendered from the official field CAD by Cameron (Juniormunk) on Chief Delphi, without the background or fuel:
// https://www.chiefdelphi.com/t/2026-rebuilt-high-resolution-field-image/510611
import fieldImage from '@/widgets/fields/2026-rebuilt.webp';

/** The field image on its background, in SVG coordinates */
export function FieldImage() {
	return (
		<g
			transform={`translate(${image.right / pixelsPerMeterX} ${image.top / pixelsPerMeterY}) scale(${-1 / pixelsPerMeterX} ${-1 / pixelsPerMeterY})`}
		>
			<rect width={image.width} height={image.height} fill={fieldBackground} />
			<image href={fieldImage} width={image.width} height={image.height} />
		</g>
	);
}

/**
 * Corner radius for the zoomed-in part's outline, concentric with the minimap's corner so they match where they meet.
 * `x` and `y` are the corner's insets from the minimap's sides, as fractions of its size.
 */
function outlineRadius(x: number, y: number): string {
	return `max(2px, var(--radius-sm) - max(${x * 100}cqw, ${y * 100}cqh))`;
}

/**
 * The whole field with the zoomed-in part outlined, shown while zooming or panning. It's in the top-right corner, or the
 * top-left one while the pointer is on the right, so it doesn't cover what the user is zooming into.
 */
export function Minimap({ zoom, visible, left }: { zoom: Zoom; visible: boolean; left: boolean }) {
	// The outlined part's insets from each edge, as fractions of the minimap
	const insetLeft = ((view.x - zoom.x) / zoom.scale - view.x) / view.width;
	const insetTop = ((view.y - zoom.y) / zoom.scale - view.y) / view.height;
	const insetRight = 1 - insetLeft - 1 / zoom.scale;
	const insetBottom = 1 - insetTop - 1 / zoom.scale;

	return (
		<div
			className={cn(
				'pointer-events-none absolute top-2 w-1/4 overflow-hidden rounded-sm shadow-black/50 shadow-lg ring-1 ring-black/60 transition-opacity duration-300 [container-type:size]',
				left ? 'left-2' : 'right-2',
				visible ? 'opacity-100' : 'opacity-0',
			)}
			style={{ aspectRatio }}
			aria-hidden
		>
			<svg className="block size-full" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}>
				<FieldImage />
			</svg>
			<div
				className="absolute border-[1.5px] border-white bg-white/20"
				style={{
					left: `${insetLeft * 100}%`,
					top: `${insetTop * 100}%`,
					width: `${100 / zoom.scale}%`,
					height: `${100 / zoom.scale}%`,
					borderTopLeftRadius: outlineRadius(insetLeft, insetTop),
					borderTopRightRadius: outlineRadius(insetRight, insetTop),
					borderBottomRightRadius: outlineRadius(insetRight, insetBottom),
					borderBottomLeftRadius: outlineRadius(insetLeft, insetBottom),
				}}
			/>
		</div>
	);
}
