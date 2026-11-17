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
 * The whole field with the zoomed-in part outlined, shown while zooming or panning. It's in the top-right corner, or the
 * top-left one while the pointer is on the right, so it doesn't cover what the user is zooming into.
 */
export function Minimap({ zoom, visible, left }: { zoom: Zoom; visible: boolean; left: boolean }) {
	return (
		<svg
			className={cn(
				'pointer-events-none absolute top-2 w-1/4 rounded-sm shadow-black/50 shadow-lg ring-1 ring-black/60 transition-opacity duration-300',
				left ? 'left-2' : 'right-2',
				visible ? 'opacity-100' : 'opacity-0',
			)}
			style={{ aspectRatio }}
			viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
			aria-hidden
		>
			<FieldImage />
			<rect
				x={(view.x - zoom.x) / zoom.scale}
				y={(view.y - zoom.y) / zoom.scale}
				width={view.width / zoom.scale}
				height={view.height / zoom.scale}
				fill="white"
				fillOpacity={0.2}
				stroke="white"
				strokeWidth={1.5}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
