import { colorVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps } from 'react';

const styles = stylex.create({
	label: {
		display: 'flex',
		alignItems: 'center',
		height: 32,
		marginBlock: spacingVars['--spacing-1'],
		paddingInline: spacingVars['--spacing-2'],
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
	},
	labelText: {
		marginInlineEnd: spacingVars['--spacing-2'],
		fontSize: typeScaleVars['--text-label-size'],
		fontWeight: 500,
	},
});

/** A muted label starting a section. The collapsed sidebar hides its contents but keeps its space, so nothing moves. */
export function SectionLabel({
	label,
	children,
	...props
}: Omit<ComponentProps<'div'>, 'className'> & { label: string }) {
	return (
		<div data-sidebar="group-label" {...props} {...stylex.props(styles.label)}>
			<span data-sidebar-label="" {...stylex.props(styles.labelText)}>
				{label}
			</span>
			{children}
		</div>
	);
}
