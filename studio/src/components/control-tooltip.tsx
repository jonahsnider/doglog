import type { Hotkey } from '@tanstack/react-hotkeys';
import type { ReactElement } from 'react';
import { TooltipLabel } from '@/components/tooltip-label';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';

export function ControlTooltip({
	label,
	shortcut,
	render,
	children,
}: {
	label: string;
	shortcut?: Hotkey;
	render: ReactElement;
	children: ReactElement;
}) {
	return (
		<Tooltip>
			<TooltipTrigger render={render}>{children}</TooltipTrigger>
			<TooltipPopup>
				<TooltipLabel label={label} shortcut={shortcut} />
			</TooltipPopup>
		</Tooltip>
	);
}
