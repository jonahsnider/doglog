import { useRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import ArrowLeftIcon from 'lucide-react/icons/arrow-left';
import ArrowRightIcon from 'lucide-react/icons/arrow-right';
import PanelLeftIcon from 'lucide-react/icons/panel-left';
import type { ComponentProps, ReactNode } from 'react';
import { shortcuts } from '@/commands/commands';
import { goInHistory, type HistoryStep, useCanGoInHistory } from '@/commands/history';
import { TooltipLabel } from '@/components/tooltip-label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { dragRegion, useTitleBarStrip, useTrafficLights } from '@/desktop/title-bar';
import { cn } from '@/lib/utils';
import { sidebarAnimationStore } from '@/sidebar/sidebar';

function TitleBarButton({
	label,
	tooltip,
	children,
	...props
}: ComponentProps<typeof Button> & { label: string; tooltip: ReactNode }) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label={label} {...props} />}>
				{children}
			</TooltipTrigger>
			<TooltipPopup>{tooltip}</TooltipPopup>
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
			disabled={!useCanGoInHistory(step)}
			className="shrink-0"
			onClick={() => goInHistory(router, step)}
		>
			{step === -1 ? <ArrowLeftIcon /> : <ArrowRightIcon />}
		</TitleBarButton>
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
	// Whether the sidebar is animating, see `sidebarAnimationStore`
	const animating = useSelector(sidebarAnimationStore) !== undefined;
	const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
	return (
		<div
			{...dragRegion}
			// Uncovered by the peeking sidebar's edge as it slides, like the rest of it, see `index.css`
			data-peek-clip={strip ? undefined : ''}
			className={cn(
				// The top padding lines the buttons up with the pane headers, which are below the dashboard's gap, and keeps the window draggable from its top edge
				'absolute start-0 top-0 z-30 flex h-10.5 items-center gap-0.5 pt-1.5 pe-2',
				// The toggle lines up with the rail's icons, unless it's after the traffic lights
				trafficLights ? 'ps-22.25' : 'ps-3',
				// Clipped to the sidebar as it animates, so the name doesn't cover the main area, sized and animated like it
				'overflow-hidden',
				// Stays at the sidebar's full width while peeking fades out, see `AppSidebar`
				strip
					? 'w-screen'
					: iconOnly
						? 'w-(--sidebar-width-icon) in-data-[animation=unpeek]:w-(--sidebar-width)'
						: 'w-(--sidebar-width)',
				// Peeking slides the sidebar in and out at its full width, with `--peek` like it, see `index.css`
				collapsed && !iconOnly ? '[--peek:1]' : '[--peek:0]',
				'transition-[--peek] duration-200 motion-reduce:transition-none in-data-[animation=collapse]:transition-[width] in-data-[animation=expand]:transition-[width]',
			)}
		>
			<TitleBarButton
				label={label}
				tooltip={<TooltipLabel label={label} shortcut={shortcuts.toggleSidebar} />}
				aria-expanded={!collapsed}
				className="shrink-0"
				onClick={onToggle}
			>
				<PanelLeftIcon />
			</TitleBarButton>
			{(!iconOnly || strip || animating) && (
				// The margin makes it as far from the icons as they are from each other, since they have padding around them
				// The sidebar and the strip are wide enough for it beside the traffic lights and buttons
				// It's clipped instead of truncated while the sidebar animates, so the ellipsis doesn't move every frame
				<span
					className={cn('mx-1.5 truncate font-heading text-sm font-semibold', animating ? 'shrink-0' : 'min-w-0')}
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
