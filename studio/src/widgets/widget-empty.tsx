import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Spinner } from '@astryxdesign/core/Spinner';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({
	widget: {
		minHeight: '100%',
		justifyContent: 'center',
		paddingBlock: spacingVars['--spacing-6'],
	},
	loading: {
		display: 'grid',
		height: '100%',
		placeItems: 'center',
	},
});

/**
 * A widget waiting on something, filling it. `label` is shown under the spinner, or only announced when `hasVisibleLabel`
 * is false, for short waits like loading the widget's code.
 */
export function WidgetLoading({
	label,
	hasVisibleLabel = true,
	isCapturePending = false,
}: {
	label: string;
	hasVisibleLabel?: boolean;
	/** Whether copying an image waits for it, for content that's about to load rather than a connection */
	isCapturePending?: boolean;
}) {
	return (
		<div role="status" data-capture-pending={isCapturePending ? '' : undefined} {...stylex.props(styles.loading)}>
			<Spinner size="lg" aria-label={label} label={hasVisibleLabel ? label : undefined} />
		</div>
	);
}

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
