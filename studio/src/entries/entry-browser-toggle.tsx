import { IconButton } from '@astryxdesign/core/IconButton';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import PanelRightCloseIcon from 'lucide-react/icons/panel-right-close';
import PanelRightOpenIcon from 'lucide-react/icons/panel-right-open';
import { TooltipLabel } from '@/components/tooltip-label';
import { shortcuts } from '@/commands/commands';
import { toggleEntryBrowser } from '@/entries/editing';

export function ToggleButton({ open }: { open: boolean }) {
	const label = open ? 'Hide entry browser' : 'Show entry browser';
	return (
		<Tooltip content={<TooltipLabel label={label} shortcut={shortcuts.toggleEntryBrowser} />}>
			<IconButton
				label={label}
				icon={open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
				variant="ghost"
				size="sm"
				aria-expanded={open}
				onClick={toggleEntryBrowser}
			/>
		</Tooltip>
	);
}
