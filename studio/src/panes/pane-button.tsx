import { IconButton } from '@astryxdesign/core/IconButton';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import type { Hotkey } from '@tanstack/react-hotkeys';
import type { ReactNode } from 'react';
import { TooltipLabel } from '@/components/tooltip-label';

/** A button in a pane's toolbar, with its shortcut in its tooltip */
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
	/** Makes it a toggle, shown pressed while on */
	pressed?: boolean;
	onClick: () => void;
	/** The icon */
	children: ReactNode;
}) {
	return (
		<Tooltip content={<TooltipLabel label={label} shortcut={shortcut} />}>
			{pressed === undefined ? (
				<IconButton label={label} icon={children} variant="ghost" isDisabled={disabled} onClick={onClick} />
			) : (
				<ToggleButton
					label={label}
					icon={children}
					isIconOnly
					isPressed={pressed}
					isDisabled={disabled}
					onPressedChange={onClick}
				/>
			)}
		</Tooltip>
	);
}
