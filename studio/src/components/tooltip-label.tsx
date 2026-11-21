import { type Hotkey, useFormatForDisplay } from '@tanstack/react-hotkeys';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

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
