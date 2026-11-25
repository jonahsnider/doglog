import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { colorVars, fontWeightVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import type { ShowToastFn, ToastDismissFn } from '@astryxdesign/core/Toast';
import * as stylex from '@stylexjs/stylex';
import CircleAlertIcon from 'lucide-react/icons/circle-alert';
import CircleCheckIcon from 'lucide-react/icons/circle-check';
import InfoIcon from 'lucide-react/icons/info';
import TriangleAlertIcon from 'lucide-react/icons/triangle-alert';
import { nanoid } from 'nanoid';
import type { ReactNode } from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface ToastOptions {
	type?: ToastType;
	title: ReactNode;
	description?: ReactNode;
	/** A button at the end of the toast */
	actionProps?: { children: string; onClick: () => void };
	/** Milliseconds before it hides on its own, 0 keeps it until it's dismissed. Errors and loading toasts always stay. */
	timeout?: number;
}

const styles = stylex.create({
	body: {
		display: 'flex',
		gap: spacingVars['--spacing-2'],
	},
	// As tall as a line of the title, so the icon lines up with it
	iconLine: {
		display: 'flex',
		alignItems: 'center',
		height: '1lh',
	},
	icon: {
		flexShrink: 0,
		width: 16,
		height: 16,
	},
	info: { color: colorVars['--color-icon-info'] },
	success: { color: colorVars['--color-icon-success'] },
	warning: { color: colorVars['--color-icon-warning'] },
	text: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5'],
	},
	title: {
		fontWeight: fontWeightVars['--font-weight-medium'],
	},
	description: {
		userSelect: 'text',
		opacity: 0.8,
	},
});

const icons: Record<ToastType, ReactNode> = {
	info: <InfoIcon {...stylex.props(styles.icon, styles.info)} />,
	success: <CircleCheckIcon {...stylex.props(styles.icon, styles.success)} />,
	warning: <TriangleAlertIcon {...stylex.props(styles.icon, styles.warning)} />,
	error: <CircleAlertIcon {...stylex.props(styles.icon)} />,
	loading: <Spinner size="sm" />,
};

let show: ShowToastFn | undefined;
/** Toasts added before the viewport connects, ex. from the update check at startup */
const queued = new Map<string, ToastOptions>();
const dismissers = new Map<string, ToastDismissFn>();

function showToast(id: string, { type = 'info', title, description, actionProps, timeout }: ToastOptions): void {
	if (show === undefined) {
		queued.set(id, { type, title, description, actionProps, timeout });
		return;
	}
	const dismiss = show({
		uniqueID: id,
		type: type === 'error' ? 'error' : 'info',
		isAutoHide: type !== 'error' && type !== 'loading' && timeout !== 0,
		...(timeout !== undefined && timeout > 0 && { autoHideDuration: timeout }),
		body: (
			<span {...stylex.props(styles.body)}>
				<span {...stylex.props(styles.iconLine)}>{icons[type]}</span>
				<span {...stylex.props(styles.text)}>
					<span {...stylex.props(styles.title)}>{title}</span>
					{description !== undefined && <span {...stylex.props(styles.description)}>{description}</span>}
				</span>
			</span>
		),
		endContent: actionProps && (
			<Button
				label={actionProps.children}
				size="sm"
				onClick={() => {
					actionProps.onClick();
					dismiss();
				}}
			/>
		),
		onHide: () => {
			dismissers.delete(id);
		},
	});
	dismissers.set(id, dismiss);
}

/** Shows toasts from anywhere, including outside React. `update` replaces a toast's contents in place, or shows it with that ID if it's gone. */
export const toastManager = {
	add(options: ToastOptions): string {
		const id = nanoid();
		showToast(id, options);
		return id;
	},
	update(id: string, options: ToastOptions): void {
		showToast(id, options);
	},
	close(id: string): void {
		queued.delete(id);
		dismissers.get(id)?.();
	},
};

/** Connects `toastManager` to the toast viewport, see `Toasts`. Shows toasts added before it connected. */
export function connectToasts(showToastInViewport: ShowToastFn): () => void {
	show = showToastInViewport;
	for (const [id, options] of queued) {
		showToast(id, options);
	}
	queued.clear();
	return () => {
		show = undefined;
	};
}
