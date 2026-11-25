import { HStack } from '@astryxdesign/core/Layout';
import type { Hotkey } from '@tanstack/react-hotkeys';
import { Shortcut } from '@/components/shortcut';

export function TooltipLabel({
	label,
	shortcut,
}: {
	label: string;
	shortcut?: Hotkey | readonly Hotkey[] | undefined;
}) {
	const hotkeys = shortcut === undefined ? [] : [shortcut].flat();
	return (
		<HStack gap={2} vAlign="center">
			{label}
			{hotkeys.map((hotkey) => (
				<Shortcut key={String(hotkey)} hotkey={hotkey} />
			))}
		</HStack>
	);
}
