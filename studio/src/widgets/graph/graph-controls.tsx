import { colorVars, fontWeightVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { Shortcut } from '@/components/shortcut';

const styles = stylex.create({
	controls: {
		display: 'grid',
		gridTemplateColumns: 'auto minmax(0, 1fr)',
		alignItems: 'baseline',
		marginBlockStart: spacingVars['--spacing-4'],
		columnGap: spacingVars['--spacing-3'],
		rowGap: spacingVars['--spacing-1'],
		textAlign: 'start',
		textWrap: 'wrap',
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
	},
	action: {
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: colorVars['--color-text-primary'],
	},
});

export function GraphControls() {
	const controls = stylex.props(styles.controls);
	const action = stylex.props(styles.action);
	return (
		<dl aria-label="Graph controls" {...controls} className={`${controls.className} capture-hidden`}>
			<dt {...action}>Seek</dt>
			<dd>Click or tap</dd>
			<dt {...action}>Measure</dt>
			<dd>Drag left or right</dd>
			<dt {...action}>Pan</dt>
			<dd>
				<Shortcut hotkey="Shift" /> + drag or scroll sideways
			</dd>
			<dt {...action}>Zoom time</dt>
			<dd>Scroll or pinch on a trackpad</dd>
			<dt {...action}>Zoom Y</dt>
			<dd>
				Scroll over the axis or <Shortcut hotkey="Shift" /> + scroll in the plot
			</dd>
		</dl>
	);
}
