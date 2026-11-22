import { shortcuts } from '@/commands/commands';
import type { MenuEntry } from '@/components/app-context-menu';
import type { SplitDirection } from '@/panes/layout';

/** The context menu's split items, hidden for panes that aren't `splittable` like `PaneLayoutButtons` */
export function splitMenuItems(
	allowed: { splittable: boolean; splitRight: boolean; splitDown: boolean },
	onSplit: (direction: SplitDirection) => void,
): MenuEntry[] {
	if (!allowed.splittable) {
		return [];
	}
	return [
		{
			label: 'Split right',
			shortcut: shortcuts.splitRight,
			disabled: !allowed.splitRight,
			onSelect: () => onSplit('row'),
		},
		{
			label: 'Split down',
			shortcut: shortcuts.splitDown,
			disabled: !allowed.splitDown,
			onSelect: () => onSplit('column'),
		},
	];
}
