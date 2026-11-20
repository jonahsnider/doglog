import { type Hotkey, useFormatForDisplay } from '@tanstack/react-hotkeys';
import { SidebarMenuBadge } from '@/components/ui/sidebar';
import { Kbd } from '@/components/ui/kbd';
import { useShortcutHint } from '@/commands/commands';

export function ShortcutHint({ shortcut }: { shortcut: Hotkey }) {
	const formatForDisplay = useFormatForDisplay();
	return (
		useShortcutHint(shortcut) && (
			<SidebarMenuBadge>
				<Kbd>{formatForDisplay(shortcut)}</Kbd>
			</SidebarMenuBadge>
		)
	);
}
