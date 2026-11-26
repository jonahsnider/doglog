import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, Layout, LayoutContent, VStack } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import { dashboardShortcut, redoAlternate, shortcuts } from '@/commands/commands';
import { keyboardShortcutsDialogOpen } from '@/commands/keyboard-shortcuts-dialog-handle';
import { Kbd, Shortcut } from '@/components/shortcut';
import { exportLiveShortcut } from '@/data/export-live';
import { canCapture } from '@/desktop/capture';
import { useSettings } from '@/settings';
import { type Hotkey, useHotkey } from '@tanstack/react-hotkeys';
import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import SkipBackIcon from 'lucide-react/icons/skip-back';
import SkipForwardIcon from 'lucide-react/icons/skip-forward';
import { Fragment, type ReactNode } from 'react';

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

interface ShortcutRow {
	label: string;
	/** Alternative shortcuts, or the first and last of a range. Alternative pairs go on separate lines. */
	keys: readonly (Key | KeyPair)[];
	/** Shown between the keys, `or` by default */
	separator?: string;
}

const sections: {
	title: string;
	shortcuts: ShortcutRow[];
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
			{ label: 'Open from URL', keys: [shortcuts.openLogUrl] },
			{ label: 'Export live data as WPILOG', keys: [exportLiveShortcut] },
			{ label: 'Connect', keys: [shortcuts.connect] },
		],
	},
	{
		title: 'Collaboration and sharing',
		shortcuts: [
			{ label: 'Copy dashboard link', keys: [shortcuts.copyDashboardLink] },
			...(canCapture ? [{ label: 'Copy dashboard image', keys: [shortcuts.copyDashboardImage] }] : []),
			...(canCapture ? [{ label: 'Export dashboard video', keys: [shortcuts.exportVideo] }] : []),
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
								<PlayIcon size="1em" />
								<PauseIcon size="1em" />
							</>
						),
					},
				],
			},
			{
				label: 'Previous / next section',
				keys: [
					[
						{ name: 'Previous track', icon: <SkipBackIcon size="1em" /> },
						{ name: 'Next track', icon: <SkipForwardIcon size="1em" /> },
					],
				],
			},
		],
	},
];

const styles = stylex.create({
	// Sections flow down two columns once the dialog has room, without splitting a section across them
	columns: {
		columnWidth: '18rem',
		columnGap: spacingVars['--spacing-8'],
	},
	section: {
		breakInside: 'avoid',
		marginBottom: spacingVars['--spacing-4'],
	},
});

function KeyView({ shortcutKey }: { shortcutKey: Key }) {
	if (!isIconKey(shortcutKey)) {
		return <Shortcut hotkey={shortcutKey} />;
	}
	return (
		<Kbd>
			<VisuallyHidden>{shortcutKey.name}</VisuallyHidden>
			{shortcutKey.icon}
		</Kbd>
	);
}

function keyName(key: Key | KeyPair): string {
	if (isKeyPair(key)) {
		return `${keyName(key[0])}/${keyName(key[1])}`;
	}
	return isIconKey(key) ? key.name : String(key);
}

/** A label's keys, with each alternative pair on its own line */
function ShortcutKeys({ shortcut }: { shortcut: ShortcutRow }) {
	const lines = shortcut.keys.some(isKeyPair) ? shortcut.keys.map((key) => [key]) : [shortcut.keys];
	return (
		<VStack gap={1} hAlign="end">
			{lines.map((line, lineIndex) => (
				<HStack key={keyName(line[0]!)} gap={1} vAlign="center">
					{lineIndex > 0 && <Separator>or</Separator>}
					{line.map((key, index) => (
						<Fragment key={keyName(key)}>
							{index > 0 && <Separator>{shortcut.separator ?? 'or'}</Separator>}
							{isKeyPair(key) ? (
								<>
									<KeyView shortcutKey={key[0]} />
									<Separator>/</Separator>
									<KeyView shortcutKey={key[1]} />
								</>
							) : (
								<KeyView shortcutKey={key} />
							)}
						</Fragment>
					))}
				</HStack>
			))}
		</VStack>
	);
}

function Separator({ children }: { children: ReactNode }) {
	return (
		<Text type="supporting" color="secondary">
			{children}
		</Text>
	);
}

const setOpen = (next: boolean) => keyboardShortcutsDialogOpen.set(next);

/** Lists app-wide keyboard shortcuts, opened from the sidebar or with its own shortcut. Widgets show their own. */
export function KeyboardShortcutsDialog() {
	const open = useSelector(keyboardShortcutsDialogOpen);
	const { mediaControls } = useSettings();
	useHotkey(shortcuts.keyboardShortcuts, () => setOpen(!keyboardShortcutsDialogOpen.get()), { requireReset: true });

	return (
		<Dialog isOpen={open} onOpenChange={setOpen} width={768}>
			<Layout
				header={<DialogHeader title="Keyboard shortcuts" onOpenChange={setOpen} />}
				content={
					<LayoutContent>
						<div {...stylex.props(styles.columns)}>
							{sections
								.filter((section) => mediaControls || section.mediaControls !== true)
								.map((section) => (
									<div key={section.title} {...stylex.props(styles.section)}>
										<List header={section.title} density="compact" edge="flush">
											{section.shortcuts.map((shortcut) => (
												<ListItem
													key={shortcut.label}
													label={shortcut.label}
													align="first-line"
													endContent={<ShortcutKeys shortcut={shortcut} />}
												/>
											))}
										</List>
									</div>
								))}
						</div>
					</LayoutContent>
				}
			/>
		</Dialog>
	);
}
