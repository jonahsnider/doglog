import { type Hotkey, useFormatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { useState } from 'react';
import { dashboardShortcut, shortcuts } from '@/commands/commands';
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { widgetTypes } from '@/widgets/registry';

interface Shortcut {
	label: string;
	/** Alternative shortcuts, or the first and last of a range */
	keys: readonly Hotkey[];
	/** Shown between the keys, `or` by default */
	separator?: string;
}

const sections: { title: string; shortcuts: Shortcut[] }[] = [
	{
		title: 'General',
		shortcuts: [
			{ label: 'New dashboard', keys: [shortcuts.newDashboard] },
			{ label: 'Close pane or dashboard', keys: [shortcuts.close] },
			{ label: 'Close dashboard', keys: [shortcuts.closeDashboard] },
			{ label: 'Reopen closed dashboard', keys: [shortcuts.reopenDashboard] },
			{ label: 'Switch to dashboard 1-9', keys: [dashboardShortcut(0)!, dashboardShortcut(8)!], separator: '–' },
			{ label: 'Undo', keys: [shortcuts.undo] },
			{ label: 'Redo', keys: [shortcuts.redo] },
			{ label: 'Logs', keys: [shortcuts.logs] },
			{ label: 'Settings', keys: [shortcuts.settings] },
			{ label: 'Keyboard shortcuts', keys: [shortcuts.keyboardShortcuts] },
		],
	},
	{
		title: 'Layout',
		shortcuts: [
			{ label: 'Toggle sidebar', keys: [shortcuts.toggleSidebar] },
			{ label: 'Toggle entry browser', keys: [shortcuts.toggleEntryBrowser] },
			{ label: 'Split right', keys: [shortcuts.splitRight] },
			{ label: 'Split down', keys: [shortcuts.splitDown] },
		],
	},
	{
		title: 'Empty pane',
		shortcuts: widgetTypes.map((type) => ({ label: `Add ${type.name.toLowerCase()}`, keys: [type.hotkey] })),
	},
	{
		title: 'Data',
		shortcuts: [
			{ label: 'Open log', keys: [shortcuts.openLog] },
			{ label: 'Connect', keys: [shortcuts.connect] },
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
			{ label: 'Jump to start', keys: ['Home'] },
			{ label: 'Jump to end', keys: ['End'] },
			{ label: 'Slower playback', keys: ['[', '<'] },
			{ label: 'Faster playback', keys: [']', '>'] },
		],
	},
	{
		title: 'Field, while hovered',
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
	useHotkey(shortcuts.keyboardShortcuts, () => setOpen((value) => !value), { requireReset: true });

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogPopup className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Keyboard shortcuts</DialogTitle>
				</DialogHeader>
				<DialogPanel className="gap-x-10 sm:columns-2">
					{sections.map((section) => (
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
											{shortcut.keys
												.map((hotkey) => formatForDisplay(hotkey))
												.map((key, index) => (
													<span key={key} className="flex items-center gap-1">
														{index > 0 && (shortcut.separator ?? 'or')}
														<Kbd>{key}</Kbd>
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
