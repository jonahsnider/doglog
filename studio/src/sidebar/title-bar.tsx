import { useRouter } from '@tanstack/react-router';
import ArrowLeftIcon from 'lucide-react/icons/arrow-left';
import ArrowRightIcon from 'lucide-react/icons/arrow-right';
import PanelLeftIcon from 'lucide-react/icons/panel-left';
import type { ComponentProps, ReactNode } from 'react';
import { shortcuts } from '@/commands/commands';
import { goInHistory, type HistoryStep, useCanGoInHistory } from '@/commands/history';
import { TooltipLabel } from '@/components/tooltip-label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { dragRegion, useTrafficLights } from '@/desktop/title-bar';
import { cn } from '@/lib/utils';

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
	const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
	return (
		<div
			{...dragRegion}
			className={cn(
				'absolute start-0 top-0 z-30 flex h-9 items-center gap-0.5 pe-2',
				// The toggle lines up with the rail's icons, `--title-bar-overlap` in `index.css` depends on this layout
				trafficLights ? 'ps-21' : 'ps-3',
				iconOnly ? 'w-full' : 'w-(--sidebar-width)',
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
			{!iconOnly && (
				// The margin makes it as far from the icons as they are from each other, since they have padding around them
				// The sidebar is wide enough for it beside the traffic lights and buttons
				<span className="mx-1.5 min-w-0 truncate font-heading text-sm font-semibold">DogLog Studio</span>
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
