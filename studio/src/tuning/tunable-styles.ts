import {
	colorVars,
	radiusVars,
	sizeVars,
	spacingVars,
	textSizeVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';

/** Styles shared by the tuning widget's parts */
export const tunableStyles = stylex.create({
	row: {
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		minHeight: sizeVars['--size-element-md'],
		paddingInline: spacingVars['--spacing-1-5'],
		borderRadius: radiusVars['--radius-inner'],
		backgroundColor: { default: null, ':hover': colorVars['--color-overlay-hover'] },
	},
	// Values and notes about them line up by place value
	code: {
		fontFamily: typographyVars['--font-family-code'],
		fontSize: textSizeVars['--font-size-sm'],
		fontVariantNumeric: 'tabular-nums',
		color: colorVars['--color-text-secondary'],
	},
	truncate: {
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
});
