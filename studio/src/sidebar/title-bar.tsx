import { useRouter } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { shortcuts } from '@/commands/commands';
import { goInHistory, type HistoryStep, useCanGoInHistory } from '@/commands/history';
import { TooltipLabel } from '@/components/tooltip-label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { dragRegion, useTrafficLights } from '@/desktop/title-bar';

function HistoryButton({ step }: { step: HistoryStep }) {
	const router = useRouter();
	const label = step === -1 ? 'Back' : 'Forward';
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label={label}
						disabled={!useCanGoInHistory(step)}
						onClick={() => goInHistory(router, step)}
					/>
				}
			>
				{step === -1 ? <ArrowLeftIcon /> : <ArrowRightIcon />}
			</TooltipTrigger>
			<TooltipPopup>
				<TooltipLabel label={label} shortcut={step === -1 ? shortcuts.back : shortcuts.forward} />
			</TooltipPopup>
		</Tooltip>
	);
}

/** Takes the title bar's place on macOS, the traffic lights are drawn over its start */
export function TitleBar() {
	return (
		useTrafficLights() && (
			<div
				{...dragRegion}
				data-slot="title-bar"
				// The traffic lights are wider than the rail, so it matches the top left pane's header to make one bar under them
				className="-mx-2 -mt-2 -mb-2 flex h-9 shrink-0 items-center ps-21 pe-2 font-heading text-sm font-semibold select-none group-data-[collapsible=icon]:border-b group-data-[collapsible=icon]:bg-background"
			>
				<span className="truncate group-data-[collapsible=icon]:hidden">DogLog Studio</span>
				<div className="ms-auto flex shrink-0 gap-0.5 group-data-[collapsible=icon]:hidden">
					<HistoryButton step={-1} />
					<HistoryButton step={1} />
				</div>
			</div>
		)
	);
}
