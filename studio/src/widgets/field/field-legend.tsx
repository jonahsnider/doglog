import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	shadowVars,
	spacingVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { Ref } from 'react';
import { Legend, type LegendItem } from '@/widgets/legend/legend';

const styles = stylex.create({
	// Wide when it's above the field, and tall beside it when the pane is wider than the viewed field. The 2D field sets
	// these container names on its root.
	legend: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: 'max-content',
		maxWidth: {
			default: '100%',
			'@container field-landscape (min-aspect-ratio: 1.925)': '33cqw',
			'@container field-portrait (min-aspect-ratio: 0.52)': '33cqw',
		},
		maxHeight: {
			default: '33%',
			'@container field-landscape (min-aspect-ratio: 1.925)': '100%',
			'@container field-portrait (min-aspect-ratio: 0.52)': '100%',
		},
		overflowY: 'auto',
		paddingInlineEnd: spacingVars['--spacing-2'],
		paddingBottom: spacingVars['--spacing-2'],
		borderEndEndRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-surface'],
		transitionProperty: 'box-shadow',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	empty: { display: 'none' },
	underZoom: { boxShadow: shadowVars['--shadow-med'] },
});

/**
 * The 2D field's legend, floating over its top-left corner. Opaque so it's readable over the zoomed field, it matches
 * the pane until then, and it's shadowed while the zoomed field is under it.
 */
export function FieldLegend({
	ref,
	items,
	isUnderZoom,
}: {
	ref: Ref<HTMLDivElement>;
	items: LegendItem[];
	isUnderZoom: boolean;
}) {
	return (
		<div
			ref={ref}
			{...stylex.props(styles.legend, items.length === 0 && styles.empty, isUnderZoom && styles.underZoom)}
		>
			<Legend items={items} vertical />
		</div>
	);
}
