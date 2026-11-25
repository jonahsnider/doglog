import { useRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import ArrowLeftIcon from 'lucide-react/icons/arrow-left';
import ArrowRightIcon from 'lucide-react/icons/arrow-right';
import PanelLeftIcon from 'lucide-react/icons/panel-left';
import { IconButton, type IconButtonProps } from '@astryxdesign/core/IconButton';
import { fontWeightVars, spacingVars, typeScaleVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import type { ReactNode } from 'react';
import { shortcuts } from '@/commands/commands';
import { goInHistory, type HistoryStep, useCanGoInHistory } from '@/commands/history';
import { TooltipLabel } from '@/components/tooltip-label';
import { dragRegion, useTitleBarStrip, useTrafficLights } from '@/desktop/title-bar';
import { sidebarAnimationStore } from '@/sidebar/sidebar';

const styles = stylex.create({
	// As far from the icons as they are from each other, since they have padding around them
	name: {
		minWidth: 0,
		marginInline: spacingVars['--spacing-1-5'],
		overflow: 'hidden',
		fontFamily: typographyVars['--font-family-heading'],
		fontSize: typeScaleVars['--text-label-size'],
		fontWeight: fontWeightVars['--font-weight-semibold'],
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
	// Clipped instead of truncated while the sidebar animates, so the ellipsis doesn't move every frame
	animating: {
		flexShrink: 0,
	},
});

function TitleBarButton({
	label,
	tooltip,
	icon,
	...props
}: Omit<IconButtonProps, 'variant' | 'size' | 'tooltip'> & { tooltip: ReactNode }) {
	return (
		<Tooltip content={tooltip} placement="below">
			<IconButton label={label} icon={icon} variant="ghost" size="sm" {...props} />
		</Tooltip>
	);
}

function HistoryButton({ step }: { step: HistoryStep }) {
	const router = useRouter();
	const label = step === -1 ? 'Back' : 'Forward';
	return (
		<TitleBarButton
			label={label}
			tooltip={<TooltipLabel label={label} shortcut={step === -1 ? shortcuts.back : shortcuts.forward} />}
			isDisabled={!useCanGoInHistory(step)}
			icon={step === -1 ? <ArrowLeftIcon /> : <ArrowRightIcon />}
			onClick={() => goInHistory(router, step)}
		/>
	);
}

/**
 * The sidebar toggle at the top of the sidebar, beside the macOS traffic lights, then the app's name and Back and Forward when there's room.
 * It's kept outside the sidebar so the toggle isn't clipped by the collapsed rail, since the traffic lights are wider than it.
 * Then it spans the window in a strip above the rail and the main area, see `useTitleBarStrip()`.
 */
export function TitleBar({
	collapsed,
	iconOnly,
	onToggle,
}: {
	collapsed: boolean;
	/** Whether the sidebar is only showing icons, unlike when it's peeking */
	iconOnly: boolean;
	onToggle: () => void;
}) {
	const trafficLights = useTrafficLights();
	const strip = useTitleBarStrip();
	const animating = useSelector(sidebarAnimationStore) !== undefined;
	const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
	return (
		<div
			{...dragRegion}
			// Uncovered by the peeking sidebar's edge as it slides, like the rest of it, see `index.css`
			data-peek-clip={strip ? undefined : ''}
			data-title-bar=""
			data-strip={strip ? '' : undefined}
			data-traffic-lights={trafficLights ? '' : undefined}
			data-icon-only={iconOnly && !strip ? '' : undefined}
			data-peek={collapsed && !iconOnly ? '' : undefined}
		>
			<TitleBarButton
				label={label}
				tooltip={<TooltipLabel label={label} shortcut={shortcuts.toggleSidebar} />}
				aria-expanded={!collapsed}
				icon={<PanelLeftIcon />}
				onClick={onToggle}
			/>
			{(!iconOnly || strip || animating) && (
				// The sidebar and the strip are wide enough for it beside the traffic lights and buttons
				<span
					{...stylex.props(styles.name, animating && styles.animating)}
					// Fades with the sidebar's labels, unless the strip keeps it, see `index.css`
					data-sidebar-label={strip ? undefined : ''}
				>
					DogLog Studio
				</span>
			)}
			{trafficLights && (
				<>
					<HistoryButton step={-1} />
					<HistoryButton step={1} />
				</>
			)}
		</div>
	);
}
