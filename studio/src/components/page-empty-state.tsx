import { Button, type ButtonProps } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import * as stylex from '@stylexjs/stylex';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

const styles = stylex.create({
	page: {
		height: '100%',
		justifyContent: 'center',
	},
});

/** An empty state that fills and centers in a page or pane */
export function PageEmptyState({
	icon,
	title,
	description,
	actions,
}: {
	icon: ReactNode;
	title: string;
	description?: string | undefined;
	actions?: ReactNode;
}) {
	return <EmptyState icon={icon} title={title} description={description} actions={actions} xstyle={styles.page} />;
}

/** Leaves a page that only handles a link, replacing it in the history so going back doesn't open the link again */
export function BackToDashboards({
	label = 'Back to dashboards',
	variant,
}: {
	label?: string;
	variant?: ButtonProps['variant'];
}) {
	const navigate = useNavigate();
	return <Button label={label} variant={variant} onClick={() => void navigate({ to: '/', replace: true })} />;
}
