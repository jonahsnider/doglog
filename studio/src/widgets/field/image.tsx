import { useState } from 'react';
import { cn } from '@/lib/utils';
import { fieldBackground, type FieldView, image, pixelsPerMeterX, pixelsPerMeterY } from '@/widgets/field/geometry';
import type { Bounds } from '@/widgets/field/zoom';
// Rendered from the official field CAD by Cameron (Juniormunk) on Chief Delphi, without the background or fuel:
// https://www.chiefdelphi.com/t/2026-rebuilt-high-resolution-field-image/510611
import fieldImage from '@/widgets/field/2026-rebuilt.webp';

/** The field image on its background, in SVG coordinates */
export function FieldImage() {
	const [loading, setLoading] = useState(true);
	const loaded = () => setLoading(false);
	return (
		<g
			data-capture-pending={loading ? '' : undefined}
			transform={`translate(${image.right / pixelsPerMeterX} ${image.top / pixelsPerMeterY}) scale(${-1 / pixelsPerMeterX} ${-1 / pixelsPerMeterY})`}
		>
			<rect width={image.width} height={image.height} fill={fieldBackground} />
			{/* oxlint-disable-next-line react/no-unknown-property -- SVG image elements fire load and error events. */}
			<image href={fieldImage} width={image.width} height={image.height} onLoad={loaded} onError={loaded} />
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
 * The whole field with the `shown` part outlined, shown while zooming or panning. It's in the top-right corner, or the
 * top-left one while the pointer is on the right, so it doesn't cover what the user is zooming into.
 */
export function Minimap({
	shown,
	visible,
	left,
	field,
}: {
	shown: Bounds;
	visible: boolean;
	left: boolean;
	field: FieldView;
}) {
	const { bounds, aspectRatio, viewBox, transform } = field;
	// The outlined part's insets from each edge, as fractions of the minimap
	const insetLeft = (shown.x - bounds.x) / bounds.width;
	const insetTop = (shown.y - bounds.y) / bounds.height;
	const insetRight = 1 - insetLeft - shown.width / bounds.width;
	const insetBottom = 1 - insetTop - shown.height / bounds.height;

	return (
		<div
			className={cn(
				'pointer-events-none absolute top-2 w-1/4 overflow-hidden rounded-sm shadow-black/50 shadow-lg ring-1 ring-black/60 transition-opacity [container-type:size] motion-reduce:transition-none',
				left ? 'left-2' : 'right-2',
				visible ? 'opacity-100 duration-150 ease-out' : 'opacity-0 duration-100 ease-in',
			)}
			style={{ aspectRatio }}
			aria-hidden
		>
			<svg className="block size-full" viewBox={viewBox}>
				<g transform={transform}>
					<FieldImage />
				</g>
			</svg>
			<div
				className="absolute border-[1.5px] border-white bg-white/20"
				style={{
					left: `${insetLeft * 100}%`,
					top: `${insetTop * 100}%`,
					width: `${(shown.width / bounds.width) * 100}%`,
					height: `${(shown.height / bounds.height) * 100}%`,
					borderTopLeftRadius: outlineRadius(insetLeft, insetTop),
					borderTopRightRadius: outlineRadius(insetRight, insetTop),
					borderBottomRightRadius: outlineRadius(insetRight, insetBottom),
					borderBottomLeftRadius: outlineRadius(insetLeft, insetBottom),
				}}
			/>
		</div>
	);
}
