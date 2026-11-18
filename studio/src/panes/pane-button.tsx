import type { Hotkey } from '@tanstack/react-hotkeys';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ToolbarButton } from '@/components/ui/toolbar';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';

export function PaneButton({
	label,
	shortcut,
	disabled = false,
	pressed,
	onClick,
	children,
}: {
	label: string;
	shortcut?: Hotkey;
	disabled?: boolean;
	/** For toggles, shown in the primary color while on */
	pressed?: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<ToolbarButton
						render={
							<Button
								variant="ghost"
								size="icon-xs"
								// Toolbar buttons stay focusable while disabled for their tooltips, so they aren't natively `:disabled`
								className="aria-pressed:bg-primary/15 aria-pressed:text-primary aria-pressed:hover:bg-primary/25 data-disabled:cursor-default data-disabled:bg-transparent data-disabled:opacity-64"
							/>
						}
						aria-label={label}
						aria-pressed={pressed}
						disabled={disabled}
						onClick={onClick}
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipPopup>
				<TooltipLabel label={label} shortcut={shortcut} />
			</TooltipPopup>
		</Tooltip>
	);
}
