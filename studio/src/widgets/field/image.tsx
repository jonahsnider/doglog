import { durationVars, easeVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { fieldBackground, type FieldView, image, pixelsPerMeterX, pixelsPerMeterY } from '@/widgets/field/geometry';
import type { Bounds } from '@/widgets/field/zoom';
// Rendered from the official field CAD by Cameron (Juniormunk) on Chief Delphi, without the background or fuel:
// https://www.chiefdelphi.com/t/2026-rebuilt-high-resolution-field-image/510611
import fieldImage from '@/widgets/field/2026-rebuilt.webp';

const styles = stylex.create({
	minimap: {
		pointerEvents: 'none',
		position: 'absolute',
		top: spacingVars['--spacing-2'],
		width: '25%',
		overflow: 'hidden',
		containerType: 'size',
		borderRadius: radiusVars['--radius-inner'],
		// A dark ring and shadow, so it stands out from the field under it
		boxShadow: '0 0 0 1px rgb(0 0 0 / 0.6), 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)',
		transitionProperty: 'opacity',
	},
	left: { left: spacingVars['--spacing-2'] },
	right: { right: spacingVars['--spacing-2'] },
	shown: {
		opacity: 1,
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-entrance'],
	},
	hidden: {
		opacity: 0,
		transitionDuration: `calc(${durationVars['--duration-exit']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-exit'],
	},
	image: { display: 'block', width: '100%', height: '100%' },
	outline: {
		position: 'absolute',
		borderWidth: 1.5,
		borderStyle: 'solid',
		borderColor: 'white',
		backgroundColor: 'rgb(255 255 255 / 0.2)',
	},
});

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
	return `max(2px, var(--radius-inner) - max(${x * 100}cqw, ${y * 100}cqh))`;
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
			{...stylex.props(styles.minimap, left ? styles.left : styles.right, visible ? styles.shown : styles.hidden)}
			style={{ aspectRatio }}
			aria-hidden
		>
			<svg {...stylex.props(styles.image)} viewBox={viewBox}>
				<g transform={transform}>
					<FieldImage />
				</g>
			</svg>
			<div
				{...stylex.props(styles.outline)}
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
