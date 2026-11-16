import { type Hotkey, useFormatForDisplay } from '@tanstack/react-hotkeys';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

/** Tooltip content for a control, followed by its keyboard shortcuts if it has any */
export function TooltipLabel({
	label,
	shortcut,
}: {
	label: string;
	shortcut?: Hotkey | readonly Hotkey[] | undefined;
}) {
	const formatForDisplay = useFormatForDisplay();
	const keys = (shortcut === undefined ? [] : [shortcut].flat()).map((hotkey) => formatForDisplay(hotkey));
	return (
		<span className="flex items-center gap-2">
			{label}
			{keys.length > 0 && (
				<KbdGroup>
					{keys.map((key) => (
						<Kbd key={key}>{key}</Kbd>
					))}
				</KbdGroup>
			)}
		</span>
	);
}
