import { IconButton } from '@astryxdesign/core/IconButton';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import type { Hotkey } from '@tanstack/react-hotkeys';
import type { LucideIcon } from 'lucide-react/types';
import { TooltipLabel } from '@/components/tooltip-label';

/** Pane toolbar icons match the pane title's icon and text, smaller than Astryx's 16px button icons */
export const paneIconSize = 14;

/** A button in a pane's toolbar, with its shortcut in its tooltip */
export function PaneButton({
	label,
	shortcut,
	disabled = false,
	pressed,
	onClick,
	icon: Icon,
}: {
	label: string;
	shortcut?: Hotkey;
	disabled?: boolean;
	/** Makes it a toggle, shown pressed while on */
	pressed?: boolean;
	onClick: () => void;
	icon: LucideIcon;
}) {
	const icon = <Icon size={paneIconSize} aria-hidden />;
	return (
		<Tooltip content={<TooltipLabel label={label} shortcut={shortcut} />}>
			{pressed === undefined ? (
				<IconButton label={label} icon={icon} variant="ghost" isDisabled={disabled} onClick={onClick} />
			) : (
				<ToggleButton
					label={label}
					icon={icon}
					isIconOnly
					// Unlike IconButton, ToggleButton doesn't take its size from the toolbar
					size="sm"
					isPressed={pressed}
					isDisabled={disabled}
					onPressedChange={onClick}
				/>
			)}
		</Tooltip>
	);
}
