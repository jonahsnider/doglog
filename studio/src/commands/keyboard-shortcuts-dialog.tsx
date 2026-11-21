import { dashboardShortcut, redoAlternate, shortcuts } from '@/commands/commands';
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { exportLiveShortcut } from '@/data/export-live';
import { canCapture } from '@/desktop/capture';
import { useSettings } from '@/settings';
import { type Hotkey, useFormatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import SkipBackIcon from 'lucide-react/icons/skip-back';
import SkipForwardIcon from 'lucide-react/icons/skip-forward';
import { type ReactNode, useId, useState } from 'react';

/** A key without a hotkey, like a media key, shown with icons */
interface IconKey {
	name: string;
	icon: ReactNode;
}

type Key = Hotkey | IconKey;

/** Keys for the opposite actions in a label, like step back / forward */
type KeyPair = readonly [Key, Key];

function isIconKey(key: Key): key is IconKey {
	return typeof key === 'object' && 'icon' in key;
}

function isKeyPair(key: Key | KeyPair): key is KeyPair {
	return Array.isArray(key);
}

interface Shortcut {
	label: string;
	/** Alternative shortcuts, or the first and last of a range. Alternative pairs go on separate lines. */
	keys: readonly (Key | KeyPair)[];
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
			...(STUDIO_DESKTOP ? [{ label: 'New window', keys: [shortcuts.newWindow] }] : []),
			{ label: 'New dashboard', keys: [shortcuts.newDashboard] },
			{
				label: STUDIO_DESKTOP ? 'Close pane, dashboard, or window' : 'Close pane or dashboard',
				keys: [shortcuts.close],
			},
			{ label: 'Close dashboard', keys: [shortcuts.closeDashboard] },
			{ label: 'Reopen closed dashboard', keys: [shortcuts.reopenDashboard] },
			{
				label: 'Undo / redo',
				keys: [
					[shortcuts.undo, shortcuts.redo],
					...(redoAlternate === undefined ? [] : [[shortcuts.undo, redoAlternate] as const]),
				],
			},
			{ label: 'Check for updates or update', keys: [shortcuts.update] },
			{ label: 'Keyboard shortcuts', keys: [shortcuts.keyboardShortcuts] },
		],
	},
	{
		title: 'Navigation',
		shortcuts: [
			{ label: 'Back / forward', keys: [[shortcuts.back, shortcuts.forward]] },
			{ label: 'Switch to dashboard 1-9', keys: [dashboardShortcut(0)!, dashboardShortcut(8)!], separator: '–' },
			{ label: 'Logs', keys: [shortcuts.logs] },
			{ label: 'Settings', keys: [shortcuts.settings] },
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
			{ label: 'Export live data as WPILOG', keys: [exportLiveShortcut] },
			{ label: 'Connect', keys: [shortcuts.connect] },
			{ label: 'Switch between log and live', keys: [shortcuts.switchSource] },
		],
	},
	{
		title: 'Collaboration and sharing',
		shortcuts: [
			{ label: 'Copy dashboard link', keys: [shortcuts.copyDashboardLink] },
			...(canCapture ? [{ label: 'Copy dashboard image', keys: [shortcuts.copyDashboardImage] }] : []),
			...(canCapture ? [{ label: 'Export dashboard clip', keys: [shortcuts.exportClip] }] : []),
		],
	},
	{
		title: 'Timeline',
		shortcuts: [
			{ label: 'Play or pause', keys: ['Space', 'K'] },
			{ label: 'Step back / forward', keys: [[',', '.']] },
			{ label: 'Skip back / forward 5 seconds', keys: [['ArrowLeft', 'ArrowRight']] },
			{ label: 'Skip back / forward 10 seconds', keys: [['J', 'L']] },
			{ label: 'Previous / next section', keys: [['Shift+ArrowLeft', 'Shift+ArrowRight']] },
			{
				label: 'Jump to start / end',
				keys: [
					['Home', 'End'],
					['Mod+ArrowLeft', 'Mod+ArrowRight'],
				],
			},
			{
				label: 'Slower / faster playback',
				keys: [
					['[', ']'],
					['<', '>'],
				],
			},
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
			{
				label: 'Previous / next section',
				keys: [
					[
						{ name: 'Previous track', icon: <SkipBackIcon /> },
						{ name: 'Next track', icon: <SkipForwardIcon /> },
					],
				],
			},
		],
	},
];

/** Lists app-wide keyboard shortcuts, opened from the sidebar or with its own shortcut. Widgets show their own. */
export function KeyboardShortcutsDialog({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const sectionId = useId();
	const formatForDisplay = useFormatForDisplay();
	const { mediaControls } = useSettings();
	useHotkey(shortcuts.keyboardShortcuts, () => setOpen((value) => !value), { requireReset: true });

	const keyName = (key: Key | KeyPair): string =>
		isKeyPair(key) ? `${keyName(key[0])}/${keyName(key[1])}` : isIconKey(key) ? key.name : formatForDisplay(key);
	const renderKey = (key: Key) =>
		isIconKey(key) ? <Kbd aria-label={key.name}>{key.icon}</Kbd> : <Kbd>{formatForDisplay(key)}</Kbd>;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{children}
			<DialogPopup className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Keyboard shortcuts</DialogTitle>
				</DialogHeader>
				<DialogPanel className="gap-x-10 sm:columns-2">
					{sections
						.filter((section) => mediaControls || section.mediaControls !== true)
						.map((section, sectionIndex) => (
							<section
								key={section.title}
								className="mb-6 break-inside-avoid last:mb-0"
								aria-labelledby={`${sectionId}-${sectionIndex}`}
							>
								<h3 id={`${sectionId}-${sectionIndex}`} className="mb-2 font-medium text-muted-foreground text-xs">
									{section.title}
								</h3>
								<dl className="flex flex-col gap-2 text-sm">
									{section.shortcuts.map((shortcut) => (
										<div key={shortcut.label} className="flex items-start justify-between gap-4">
											<dt>{shortcut.label}</dt>
											<dd className="flex shrink-0 flex-col items-end gap-1 text-muted-foreground text-xs">
												{(shortcut.keys.some(isKeyPair) ? shortcut.keys.map((key) => [key]) : [shortcut.keys]).map(
													(line, lineIndex) => (
														<span key={keyName(line[0]!)} className="flex items-center gap-1">
															{lineIndex > 0 && 'or'}
															{line.map((key, index) => (
																<span key={keyName(key)} className="flex items-center gap-1">
																	{index > 0 && (shortcut.separator ?? 'or')}
																	{isKeyPair(key) ? (
																		<>
																			{renderKey(key[0])}/{renderKey(key[1])}
																		</>
																	) : (
																		renderKey(key)
																	)}
																</span>
															))}
														</span>
													),
												)}
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
