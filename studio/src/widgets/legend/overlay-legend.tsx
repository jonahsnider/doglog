import { colorVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { Legend, type LegendItem } from '@/widgets/legend/legend';

const styles = stylex.create({
	// Only as tall as its rows, so it can be as wide as they need without covering much of the view
	legend: (endInset: string) => ({
		pointerEvents: 'auto',
		flexShrink: 0,
		width: 'fit-content',
		maxWidth: `calc(100% - ${endInset})`,
		maxHeight: '50%',
		marginTop: spacingVars['--spacing-1-5'],
		overflowY: 'auto',
		paddingInline: spacingVars['--spacing-1-5'],
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-surface'],
	}),
});

/**
 * A vertical legend floating over the top of a view that fills the widget, ex. a 3D scene, opaque so it's readable over
 * it. Goes in a column that spans the view and lets pointer events through to it.
 */
export function OverlayLegend({
	items,
	roles,
	endInset = '0px',
}: {
	items: LegendItem[];
	roles?: boolean;
	/** Room left beside it in the view's top-right corner, ex. for a view cube */
	endInset?: string;
}) {
	return items.length === 0 ? undefined : (
		<div {...stylex.props(styles.legend(endInset))}>
			<Legend items={items} vertical roles={roles} />
		</div>
	);
}
