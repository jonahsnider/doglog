import type { Hotkey } from '@tanstack/react-hotkeys';
import { SidebarMenuBadge } from '@/components/ui/sidebar';
import { Shortcut } from '@/components/shortcut';
import { useShortcutHint } from '@/commands/commands';

export function ShortcutHint({ shortcut }: { shortcut: Hotkey }) {
	return (
		useShortcutHint(shortcut) && (
			<SidebarMenuBadge>
				<Shortcut hotkey={shortcut} />
			</SidebarMenuBadge>
		)
	);
}
