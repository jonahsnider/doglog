import { navItemStyles } from '@astryxdesign/core/NavItem/navItemStyles.stylex';
import { colorVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { focusOutlineProps } from '@astryxdesign/core/utils/focusOutline.stylex';
import { interactionOverlayStyles } from '@astryxdesign/core/utils/interactionOverlay.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { RouterLink } from '@/components/router-link';
import { useSidebar } from '@/sidebar/sidebar-context';
import './sidebar-ui.css';

const styles = stylex.create({
	section: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-2'],
		padding: spacingVars['--spacing-2'],
	},
	content: {
		display: 'flex',
		flex: 1,
		flexDirection: 'column',
		gap: spacingVars['--spacing-2'],
		minHeight: 0,
		overflowY: 'auto',
		overscrollBehavior: 'contain',
	},
	group: {
		position: 'relative',
		display: 'flex',
		flexDirection: 'column',
		width: '100%',
		minWidth: 0,
		padding: spacingVars['--spacing-2'],
	},
	menu: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-1'],
		width: '100%',
		minWidth: 0,
		margin: 0,
		padding: 0,
		listStyle: 'none',
	},
	item: {
		position: 'relative',
	},
	button: {
		overflow: 'hidden',
		color: 'inherit',
		whiteSpace: 'nowrap',
	},
	// Lines its icon up with the other rows'
	sm: {
		paddingInline: spacingVars['--spacing-2'],
	},
	// Two lines, ex. the source control
	lg: {
		height: 48,
	},
	// Selected dashboards, besides the open one
	highlighted: {
		backgroundColor: colorVars['--color-neutral'],
	},
	// The open page or dashboard is accent muted, like the selected item in MD3's navigation drawer
	active: {
		backgroundColor: colorVars['--color-accent-muted'],
		color: colorVars['--color-text-primary'],
	},
});

type XStyle = { xstyle?: stylex.StyleXStyles | false };

export function SidebarHeader(props: Omit<ComponentProps<'div'>, 'className'>) {
	return <div data-sidebar="header" {...props} {...stylex.props(styles.section)} />;
}

export function SidebarFooter(props: Omit<ComponentProps<'div'>, 'className'>) {
	return <div data-sidebar="footer" {...props} {...stylex.props(styles.section)} />;
}

/** The scrolling middle of the sidebar, between its header and footer */
export function SidebarContent(props: Omit<ComponentProps<'div'>, 'className'>) {
	return <div data-sidebar="content" {...props} {...stylex.props(styles.content)} />;
}

export function SidebarGroup({ xstyle, ...props }: Omit<ComponentProps<'div'>, 'className'> & XStyle) {
	return <div data-sidebar="group" {...props} {...stylex.props(styles.group, xstyle)} />;
}

export function SidebarMenu({ xstyle, ...props }: Omit<ComponentProps<'ul'>, 'className'> & XStyle) {
	return <ul data-sidebar="menu" {...props} {...stylex.props(styles.menu, xstyle)} />;
}

export function SidebarMenuItem({ xstyle, ...props }: Omit<ComponentProps<'li'>, 'className'> & XStyle) {
	// After the styles, so motion's inline styles apply
	return <li data-sidebar="menu-item" {...stylex.props(styles.item, xstyle)} {...props} />;
}

type SidebarMenuButtonProps = Omit<HTMLAttributes<HTMLElement>, 'ref' | 'className'> &
	XStyle & {
		/** A callback, which both the button and the link take, ex. a drag handle's or a menu's */
		ref?: (element: HTMLElement | null) => void;
		/** Renders a link instead of a button */
		href?: string;
		disabled?: boolean;
		/** The open page or dashboard */
		isActive?: boolean;
		/** Selected along with others, ex. for closing several dashboards */
		isHighlighted?: boolean;
		/** `lg` fits two lines */
		size?: 'sm' | 'md' | 'lg';
		/** Shown in a tooltip while the sidebar only shows icons */
		tooltip?: ReactNode;
		/** Extra triggers, ex. for menus that also open from the button */
		'aria-haspopup'?: HTMLAttributes<HTMLElement>['aria-haspopup'];
	};

/** A row of the sidebar: an icon and its label, which is clipped to the icon in the rail */
export function SidebarMenuButton({
	ref,
	href,
	disabled = false,
	isActive = false,
	isHighlighted = false,
	size = 'md',
	tooltip,
	xstyle,
	children,
	...props
}: SidebarMenuButtonProps) {
	const { collapsed, isMobile } = useSidebar();
	const sx = focusOutlineProps.focusVisible(
		navItemStyles.item,
		interactionOverlayStyles.backgroundColor,
		navItemStyles[size],
		styles.button,
		size === 'sm' && styles.sm,
		size === 'lg' && styles.lg,
		isHighlighted && styles.highlighted,
		isActive && styles.active,
		disabled && navItemStyles.disabled,
		xstyle,
	);
	const shared = {
		...props,
		...sx,
		'data-sidebar': 'menu-button',
		'data-size': size,
		'data-active': isActive ? '' : undefined,
	};
	const element =
		href === undefined ? (
			<button ref={ref} type="button" disabled={disabled} {...shared}>
				{children}
			</button>
		) : (
			<RouterLink ref={ref} href={href} aria-current={isActive ? 'page' : undefined} {...shared}>
				{children}
			</RouterLink>
		);

	if (tooltip === undefined) {
		return element;
	}
	return (
		<Tooltip content={tooltip} placement="end" isEnabled={collapsed && !isMobile}>
			{element}
		</Tooltip>
	);
}

/** Passive content at the end of a row, ex. a shortcut. Hidden in the rail. */
export function SidebarMenuBadge(props: Omit<ComponentProps<'div'>, 'className'>) {
	return <div data-sidebar="menu-badge" {...props} />;
}

/** A button at the end of a row, ex. a menu. Shown while the row is hovered or focused on devices with hover. */
export function SidebarMenuAction({ hidden = false, children }: { hidden?: boolean; children: ReactNode }) {
	return (
		<div data-sidebar="menu-action" data-hidden={hidden ? '' : undefined}>
			{children}
		</div>
	);
}
