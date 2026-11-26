import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Spinner } from '@astryxdesign/core/Spinner';
import {
	colorVars,
	fontWeightVars,
	radiusVars,
	shadowVars,
	spacingVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import CircleAlertIcon from 'lucide-react/icons/circle-alert';
import CircleCheckIcon from 'lucide-react/icons/circle-check';
import InfoIcon from 'lucide-react/icons/info';
import TriangleAlertIcon from 'lucide-react/icons/triangle-alert';
import XIcon from 'lucide-react/icons/x';
import { type ReactNode, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toaster, toast } from 'sonner';
import type { ToastOptions, ToastType } from '@/components/toast';
import { TooltipLabel } from '@/components/tooltip-label';
import './toasts.css';

const styles = stylex.create({
	// On the toaster's own element, which it shortens to the front toast's height when they're stacked
	toast: {
		paddingBlock: spacingVars['--spacing-3'],
		paddingInline: spacingVars['--spacing-4'],
		borderRadius: radiusVars['--radius-container'],
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		backgroundColor: colorVars['--color-background-popover'],
		boxShadow: shadowVars['--shadow-med'],
		color: colorVars['--color-text-primary'],
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
	},
	card: {
		display: 'flex',
		alignItems: 'flex-start',
		gap: spacingVars['--spacing-3'],
	},
	body: {
		display: 'flex',
		flex: 1,
		minWidth: 0,
		gap: spacingVars['--spacing-2'],
	},
	// As tall as a line of the title, so the icon and buttons line up with it
	line: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		flexShrink: 0,
		height: '1lh',
	},
	end: {
		marginInlineEnd: `calc(${spacingVars['--spacing-2']} * -1)`,
	},
	icon: {
		flexShrink: 0,
		width: 16,
		height: 16,
	},
	// Fills the same 16px box as the icons, with the small spinner's 2px stroke on each side
	spinner: { '--spinner-diameter': '12px' },
	info: { color: colorVars['--color-icon-info'] },
	success: { color: colorVars['--color-icon-success'] },
	warning: { color: colorVars['--color-icon-warning'] },
	error: { color: colorVars['--color-icon-error'] },
	text: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5'],
	},
	title: {
		fontWeight: fontWeightVars['--font-weight-medium'],
		// Progress, ex. a download's percent, doesn't change the toast's width as it counts up
		fontVariantNumeric: 'tabular-nums',
	},
	description: {
		userSelect: 'text',
		color: colorVars['--color-text-secondary'],
	},
});

const icons: Record<ToastType, ReactNode> = {
	info: <InfoIcon {...stylex.props(styles.icon, styles.info)} />,
	success: <CircleCheckIcon {...stylex.props(styles.icon, styles.success)} />,
	warning: <TriangleAlertIcon {...stylex.props(styles.icon, styles.warning)} />,
	error: <CircleAlertIcon {...stylex.props(styles.icon, styles.error)} />,
	loading: <Spinner size="sm" className={stylex.props(styles.spinner).className} />,
};

/** A toast's contents, styled with Studio's theme */
export function ToastCard({
	id,
	type,
	title,
	description,
	actionProps,
}: ToastOptions & { id: string; type: ToastType }) {
	return (
		<div {...stylex.props(styles.card)}>
			<div {...stylex.props(styles.body)}>
				<span {...stylex.props(styles.line)}>{icons[type]}</span>
				<span {...stylex.props(styles.text)}>
					<span {...stylex.props(styles.title)}>{title}</span>
					{description !== undefined && <span {...stylex.props(styles.description)}>{description}</span>}
				</span>
			</div>
			<div {...stylex.props(styles.line, styles.end)}>
				{actionProps && (
					<Tooltip
						content={<TooltipLabel label={actionProps.children} shortcut={actionProps.shortcut} />}
						isEnabled={actionProps.shortcut !== undefined}
					>
						<Button
							label={actionProps.children}
							size="sm"
							onClick={() => {
								actionProps.onClick();
								toast.dismiss(id);
							}}
						/>
					</Tooltip>
				)}
				<IconButton
					label="Dismiss"
					icon={<XIcon />}
					variant="ghost"
					size="sm"
					onClick={() => {
						toast.dismiss(id);
					}}
				/>
			</div>
		</div>
	);
}

/**
 * Astryx's registry of open modals, shared by every copy of it on the page through this global key. Everything outside
 * the latest modal is hidden behind it and inert, so the toasts move into it, like Astryx's own toasts do.
 */
interface ModalOutlets {
	outlets: HTMLDialogElement[];
	outletGroups: WeakMap<HTMLDialogElement, string>;
	/** `entry` when a surface that isn't modal entered the top layer above the toasts */
	listeners: Set<(change: 'outlet' | 'entry') => void>;
}

function modalOutlets(): ModalOutlets {
	const realm = globalThis as typeof globalThis & Record<symbol, ModalOutlets | undefined>;
	// Created here if Astryx hasn't yet, it uses whichever is created first
	return (realm[Symbol.for('@astryxdesign/core/layer/modal-outlet/state/v1')] ??= {
		outlets: [],
		outletGroups: new WeakMap(),
		listeners: new Set(),
	});
}

/** Where `toastManager` shows toasts, rendered once at the root */
export function Toasts() {
	// A popover in the top layer, so it shows above modals and anything else there
	const [element] = useState(() => {
		const host = document.createElement('div');
		host.popover = 'manual';
		host.dataset['toasts'] = '';
		return host;
	});

	useLayoutEffect(() => {
		const registry = modalOutlets();
		const place = (change: 'outlet' | 'entry' = 'outlet') => {
			const parent = registry.outlets.at(-1) ?? document.body;
			if (element.parentNode === parent && change === 'outlet') {
				return;
			}
			// Moving the host or showing it again blurs what's focused inside it
			const focused = element.contains(document.activeElement) ? document.activeElement : undefined;
			if (element.parentNode === parent) {
				// Leaves and enters the top layer again to get above the surface that entered it
				element.hidePopover();
			} else {
				// Leaving the document hides it
				parent.append(element);
			}
			element.showPopover();
			if (focused instanceof HTMLElement) {
				focused.focus({ preventScroll: true });
			}
		};
		place();
		registry.listeners.add(place);
		return () => {
			registry.listeners.delete(place);
			element.remove();
		};
	}, [element]);

	return createPortal(
		// F6 is the usual shortcut to jump to notifications, the default Alt+T is a Studio shortcut
		<Toaster
			position="bottom-right"
			hotkey={['F6']}
			duration={5000}
			toastOptions={{ className: stylex.props(styles.toast).className }}
		/>,
		element,
	);
}
