import { useRouter } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowRightIcon, PanelLeftIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { shortcuts } from '@/commands/commands';
import { goInHistory, type HistoryStep, useCanGoInHistory } from '@/commands/history';
import { TooltipLabel } from '@/components/tooltip-label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { dragRegion, useTrafficLights } from '@/desktop/title-bar';
import { cn } from '@/lib/utils';

/** An icon-only button, named by its tooltip */
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
			onClick={() => goInHistory(router, step)}
		>
			{step === -1 ? <ArrowLeftIcon /> : <ArrowRightIcon />}
		</TitleBarButton>
	);
}

/**
 * Like Linear, the sidebar toggle at the top of the sidebar, followed by Back and Forward beside the macOS traffic lights.
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
				// The border is always there, so the buttons don't move when it's shown
				'absolute start-0 top-0 z-30 flex h-9 items-center gap-0.5 border-b border-transparent select-none',
				// The toggle lines up with the rail's icons
				trafficLights ? 'ps-21' : 'ps-3',
				iconOnly ? 'w-full' : 'w-(--sidebar-width)',
				// Matches the top left pane's header to make one bar under the traffic lights
				iconOnly && trafficLights && 'border-border bg-background',
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
			{trafficLights && !iconOnly && (
				<>
					<HistoryButton step={-1} />
					<HistoryButton step={1} />
				</>
			)}
		</div>
	);
}
