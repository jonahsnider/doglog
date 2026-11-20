import PanelRightCloseIcon from 'lucide-react/icons/panel-right-close';
import PanelRightOpenIcon from 'lucide-react/icons/panel-right-open';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { shortcuts } from '@/commands/commands';
import { toggleEntryBrowser } from '@/entries/editing';

export function ToggleButton({ open }: { open: boolean }) {
	const label = open ? 'Hide entry browser' : 'Show entry browser';
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button variant="ghost" size="icon-xs" aria-label={label} aria-expanded={open} onClick={toggleEntryBrowser} />
				}
			>
				{open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
			</TooltipTrigger>
			<TooltipPopup>
				<TooltipLabel label={label} shortcut={shortcuts.toggleEntryBrowser} />
			</TooltipPopup>
		</Tooltip>
	);
}
