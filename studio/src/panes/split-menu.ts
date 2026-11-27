import { shortcuts } from '@/commands/commands';
import type { MenuEntry } from '@/components/app-context-menu';
import type { SplitDirection } from '@/panes/layout';
import { isMobileLayout } from '@/lib/mobile-layout';

/**
 * The context menu's split and zoom items. Like `PaneLayoutButtons`, split items are hidden for panes that aren't
 * `splittable`. Zooming is left out of the phone layout, where every pane fills the dashboard.
 */
export function layoutMenuItems(
	allowed: { splittable: boolean; splitRight: boolean; splitDown: boolean },
	onSplit: (direction: SplitDirection) => void,
	{ zoomed, canZoom, onZoom }: { zoomed: boolean; canZoom: boolean; onZoom: () => void },
): MenuEntry[] {
	const zoom: MenuEntry[] = isMobileLayout()
		? []
		: [
				{
					label: zoomed ? 'Restore pane' : 'Zoom pane',
					shortcut: shortcuts.zoom,
					disabled: !canZoom,
					onSelect: onZoom,
				},
			];
	if (!allowed.splittable) {
		return zoom;
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
		...zoom,
	];
}
