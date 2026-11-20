import { dashboardShortcut, shortcuts } from '@/commands/commands';
import { isTauri } from '@tauri-apps/api/core';
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { useSettings } from '@/settings';
import { type Hotkey, useFormatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import SkipBackIcon from 'lucide-react/icons/skip-back';
import SkipForwardIcon from 'lucide-react/icons/skip-forward';
import { type ReactNode, useState } from 'react';

/** A key without a hotkey, like a media key, shown with icons */
interface IconKey {
	name: string;
	icon: ReactNode;
}

function isIconKey(key: Hotkey | IconKey): key is IconKey {
	return typeof key === 'object' && 'icon' in key;
}

interface Shortcut {
	label: string;
	/** Alternative shortcuts, or the first and last of a range */
	keys: readonly (Hotkey | IconKey)[];
	/** Shown between the keys, `or` by default */
	separator?: string;
}

const sections: {
	title: string;
	shortcuts: Shortcut[];
	/** Only shown while the media controls setting is on */
	mediaControls?: boolean;
}[] = [
	{
		title: 'General',
		shortcuts: [
			...(isTauri() ? [{ label: 'New window', keys: [shortcuts.newWindow] }] : []),
			{ label: 'New dashboard', keys: [shortcuts.newDashboard] },
			{ label: isTauri() ? 'Close pane, dashboard, or window' : 'Close pane or dashboard', keys: [shortcuts.close] },
			{ label: 'Close dashboard', keys: [shortcuts.closeDashboard] },
			{ label: 'Reopen closed dashboard', keys: [shortcuts.reopenDashboard] },
			{ label: 'Copy dashboard link', keys: [shortcuts.copyDashboardLink] },
			{ label: 'Switch to dashboard 1-9', keys: [dashboardShortcut(0)!, dashboardShortcut(8)!], separator: '–' },
			{ label: 'Back', keys: [shortcuts.back] },
			{ label: 'Forward', keys: [shortcuts.forward] },
			{ label: 'Undo', keys: [shortcuts.undo] },
			{ label: 'Redo', keys: [shortcuts.redo] },
			{ label: 'Logs', keys: [shortcuts.logs] },
			{ label: 'Settings', keys: [shortcuts.settings] },
			{ label: 'Check for updates or update', keys: [shortcuts.update] },
			{ label: 'Keyboard shortcuts', keys: [shortcuts.keyboardShortcuts] },
		],
	},
	{
		title: 'Layout',
		shortcuts: [
			{ label: 'Toggle sidebar', keys: [shortcuts.toggleSidebar] },
			{ label: 'Toggle entry browser', keys: [shortcuts.toggleEntryBrowser] },
			{ label: 'Search entries', keys: [shortcuts.searchEntries] },
			{ label: 'Split right', keys: [shortcuts.splitRight] },
			{ label: 'Split down', keys: [shortcuts.splitDown] },
			{ label: 'Zoom or restore pane', keys: [shortcuts.zoom] },
			{ label: 'Edit entries', keys: [shortcuts.editEntries] },
		],
	},
	{
		title: 'Data',
		shortcuts: [
			{ label: 'Open log', keys: [shortcuts.openLog] },
			{ label: 'Connect', keys: [shortcuts.connect] },
			{ label: 'Switch between log and live', keys: [shortcuts.switchSource] },
		],
	},
	{
		title: 'Timeline',
		shortcuts: [
			{ label: 'Play or pause', keys: ['Space', 'K'] },
			{ label: 'Step back', keys: [','] },
			{ label: 'Step forward', keys: ['.'] },
			{ label: 'Skip back 5 seconds', keys: ['ArrowLeft'] },
			{ label: 'Skip forward 5 seconds', keys: ['ArrowRight'] },
			{ label: 'Skip back 10 seconds', keys: ['J'] },
			{ label: 'Skip forward 10 seconds', keys: ['L'] },
			{ label: 'Previous section (ex. auto, teleop)', keys: ['Shift+ArrowLeft'] },
			{ label: 'Next section', keys: ['Shift+ArrowRight'] },
			{ label: 'Jump to start', keys: ['Home', 'Mod+ArrowLeft'] },
			{ label: 'Jump to end', keys: ['End', 'Mod+ArrowRight'] },
			{ label: 'Slower playback', keys: ['[', '<'] },
			{ label: 'Faster playback', keys: [']', '>'] },
		],
	},
	{
		title: 'Media keys',
		mediaControls: true,
		shortcuts: [
			{
				label: 'Play or pause',
				keys: [
					{
						name: 'Play/pause',
						icon: (
							<>
								<PlayIcon />
								<PauseIcon />
							</>
						),
					},
				],
			},
			{ label: 'Previous section', keys: [{ name: 'Previous track', icon: <SkipBackIcon /> }] },
			{ label: 'Next section', keys: [{ name: 'Next track', icon: <SkipForwardIcon /> }] },
		],
	},
	{
		title: 'Field',
		shortcuts: [
			{ label: 'Measure distance', keys: ['M'] },
			{ label: 'Measure angle', keys: ['A'] },
			{ label: 'Stop measuring', keys: ['Escape'] },
			{ label: 'Copy cursor position', keys: ['Mod+C'] },
		],
	},
];

/** Lists every keyboard shortcut, opened with its own shortcut */
export function KeyboardShortcutsDialog() {
	const [open, setOpen] = useState(false);
	const formatForDisplay = useFormatForDisplay();
	const { mediaControls } = useSettings();
	useHotkey(shortcuts.keyboardShortcuts, () => setOpen((value) => !value), { requireReset: true });

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogPopup className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Keyboard shortcuts</DialogTitle>
				</DialogHeader>
				<DialogPanel className="gap-x-10 sm:columns-2">
					{sections
						.filter((section) => mediaControls || section.mediaControls !== true)
						.map((section) => (
							<section
								key={section.title}
								className="mb-6 break-inside-avoid last:mb-0"
								aria-labelledby={`shortcuts-${section.title}`}
							>
								<h3 id={`shortcuts-${section.title}`} className="mb-2 font-medium text-muted-foreground text-xs">
									{section.title}
								</h3>
								<dl className="flex flex-col gap-2 text-sm">
									{section.shortcuts.map((shortcut) => (
										<div key={shortcut.label} className="flex items-center justify-between gap-4">
											<dt>{shortcut.label}</dt>
											<dd className="flex items-center gap-1 text-muted-foreground text-xs">
												{shortcut.keys.map((key, index) => (
													<span
														key={isIconKey(key) ? key.name : formatForDisplay(key)}
														className="flex items-center gap-1"
													>
														{index > 0 && (shortcut.separator ?? 'or')}
														{isIconKey(key) ? (
															<Kbd aria-label={key.name}>{key.icon}</Kbd>
														) : (
															<Kbd>{formatForDisplay(key)}</Kbd>
														)}
													</span>
												))}
											</dd>
										</div>
									))}
								</dl>
							</section>
						))}
				</DialogPanel>
			</DialogPopup>
		</Dialog>
	);
}
