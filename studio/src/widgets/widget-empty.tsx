import { EmptyState } from '@astryxdesign/core/EmptyState';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({
	widget: {
		minHeight: '100%',
		justifyContent: 'center',
		paddingBlock: spacingVars['--spacing-6'],
	},
});

export function WidgetEmpty({
	icon,
	title,
	description,
	children,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	/** Actions shown under the description */
	children?: ReactNode;
}) {
	return (
		<EmptyState
			icon={icon}
			title={title}
			description={description}
			actions={children}
			isCompact
			xstyle={styles.widget}
		/>
	);
}
