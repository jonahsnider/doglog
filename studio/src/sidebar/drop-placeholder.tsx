import { colorVars, radiusVars, sizeVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import LayoutDashboardIcon from 'lucide-react/icons/layout-dashboard';
import UserIcon from 'lucide-react/icons/user';
import UsersIcon from 'lucide-react/icons/users';
import { m, useIsPresent } from 'motion/react';
import type { Ref } from 'react';
import type { DraggedKind } from '@/sidebar/drag';
import { SidebarMenuItem } from '@/sidebar/sidebar-ui';

const MotionSidebarMenuItem = m.create(SidebarMenuItem);

const styles = stylex.create({
	removed: {
		display: 'none',
	},
	// Matches the dashboards' buttons, see `sidebar-ui.css` for the rail
	placeholder: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		height: sizeVars['--size-element-md'],
		overflow: 'hidden',
		paddingInline: spacingVars['--spacing-2'],
		borderWidth: 1,
		borderStyle: 'dashed',
		borderColor: colorVars['--color-border-emphasized'],
		borderRadius: radiusVars['--radius-element'],
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-label-size'],
		whiteSpace: 'nowrap',
	},
	active: {
		borderColor: colorVars['--color-accent'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 10%, transparent)`,
		color: colorVars['--color-text-accent'],
	},
});

function content(dragged: DraggedKind, shared: boolean) {
	if (dragged === 'pane') {
		return { Icon: LayoutDashboardIcon, label: shared ? 'Move to new shared dashboard' : 'Move to new dashboard' };
	}
	return shared ? { Icon: UsersIcon, label: 'Share dashboard' } : { Icon: UserIcon, label: 'Stop sharing dashboard' };
}

export function DropPlaceholder({
	ref,
	dragged,
	shared,
	active,
}: {
	ref?: Ref<HTMLLIElement>;
	dragged: DraggedKind;
	shared: boolean;
	active: boolean;
}) {
	const { Icon, label } = content(dragged, shared);
	const isPresent = useIsPresent();
	return (
		// A motion component so the dashboards' `AnimatePresence` removes it right away instead of waiting for an exit animation.
		// Hidden while it's removed, so a dashboard dropped in its spot doesn't push the ones below down for a frame.
		<MotionSidebarMenuItem
			ref={ref}
			xstyle={!isPresent && styles.removed}
			exit={{ opacity: 0 }}
			transition={{ duration: 0 }}
		>
			<div data-sidebar="drop-placeholder" {...stylex.props(styles.placeholder, active && styles.active)}>
				<Icon />
				<span>{label}</span>
			</div>
		</MotionSidebarMenuItem>
	);
}
