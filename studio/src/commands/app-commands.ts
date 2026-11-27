// oxlint-disable max-lines -- Every app-wide command is kept together, it's mostly their labels and shortcuts
import { type Hotkey, type UseHotkeyDefinition, useHotkeys } from '@tanstack/react-hotkeys';
import { type RegisteredRouter, useRouter } from '@tanstack/react-router';
import AppWindowIcon from 'lucide-react/icons/app-window';
import ArrowLeftIcon from 'lucide-react/icons/arrow-left';
import ArrowRightIcon from 'lucide-react/icons/arrow-right';
import CloudIcon from 'lucide-react/icons/cloud';
import Columns2Icon from 'lucide-react/icons/columns-2';
import Columns3Icon from 'lucide-react/icons/columns-3';
import DownloadIcon from 'lucide-react/icons/download';
import FolderOpenIcon from 'lucide-react/icons/folder-open';
import FolderSyncIcon from 'lucide-react/icons/folder-sync';
import GlobeIcon from 'lucide-react/icons/globe';
import HistoryIcon from 'lucide-react/icons/history';
import ImageIcon from 'lucide-react/icons/image';
import KeyboardIcon from 'lucide-react/icons/keyboard';
import LayoutGridPlusIcon from 'lucide-react/icons/layout-grid-plus';
import LinkIcon from 'lucide-react/icons/link';
import ListTodoIcon from 'lucide-react/icons/list-todo';
import Maximize2Icon from 'lucide-react/icons/maximize-2';
import PanelLeftIcon from 'lucide-react/icons/panel-left';
import PanelRightOpenIcon from 'lucide-react/icons/panel-right-open';
import PlusIcon from 'lucide-react/icons/plus';
import RadioTowerIcon from 'lucide-react/icons/radio-tower';
import Redo2Icon from 'lucide-react/icons/redo-2';
import RefreshCwIcon from 'lucide-react/icons/refresh-cw';
import Rows2Icon from 'lucide-react/icons/rows-2';
import SearchIcon from 'lucide-react/icons/search';
import SettingsIcon from 'lucide-react/icons/settings';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import SquareXIcon from 'lucide-react/icons/square-x';
import TextSearchIcon from 'lucide-react/icons/text-search';
import Undo2Icon from 'lucide-react/icons/undo-2';
import VideoIcon from 'lucide-react/icons/video';
import XIcon from 'lucide-react/icons/x';
import ZoomInIcon from 'lucide-react/icons/zoom-in';
import ZoomOutIcon from 'lucide-react/icons/zoom-out';
import type { LucideIcon } from 'lucide-react/types';
import { toggleCommandPalette } from '@/commands/command-palette-handle';
import {
	canUndoOrRedo,
	closeCurrentDashboard,
	closeFocused,
	dashboardNumbers,
	nativeMenu,
	newDashboard,
	newWindow,
	openDashboardAt,
	openLogs,
	openLogUrlPrompt,
	openSettings,
	redoAlternate,
	reopenDashboard,
	shortcuts,
	startConnect,
	undoOrRedo,
} from '@/commands/commands';
import {
	balancePanes,
	canBalancePanes,
	canCopyCurrentDashboard,
	canEditFocusedEntries,
	canExportCurrentDashboardVideo,
	canFindInConsole,
	canSplitFocused,
	canSplitFocusedBestFit,
	canToggleEntryBrowser,
	canZoomFocused,
	copyCurrentDashboardImage,
	copyCurrentDashboardLink,
	currentDashboard,
	exportCurrentDashboardVideo,
	findInConsole,
	splitFocused,
	splitFocusedBestFit,
	toggleDashboardEntryBrowser,
	toggleFocusedEditing,
	toggleFocusedZoom,
} from '@/commands/dashboard-commands';
import { canGoInHistory, goInHistory } from '@/commands/history';
import { toggleKeyboardShortcutsDialog } from '@/commands/keyboard-shortcuts-dialog-handle';
import { closedStore } from '@/dashboards/dashboards';
import { canExportLive, exportLive, exportLiveShortcut } from '@/data/export-live';
import { chooseLog } from '@/data/open-log';
import { canCapture } from '@/desktop/capture';
import { zoomPage } from '@/desktop/page-zoom';
import { isExportingVideo } from '@/desktop/video-export';
import { focusEntrySearch } from '@/entries/editing';
import { requestSidebarToggle } from '@/sidebar/sidebar';
import { shownTuningDashboard } from '@/tuning/dashboard';
import { checkOrInstallUpdate } from '@/updater';

const desktop = STUDIO_DESKTOP;

/** An app-wide command, which its shortcut, the macOS menu bar, the keyboard shortcuts list, and the command palette run */
export interface AppCommand {
	/** In sentence case, the macOS menu bar converts it to title case */
	label: string;
	/** Shown next to it in the command palette */
	icon: LucideIcon;
	/** Opens one of the sidebar's pages, which the command palette lists as a page */
	page?: true;
	/** Other words the command palette finds it by */
	keywords?: readonly string[];
	shortcut?: Hotkey;
	/** Hotkeys that also run it, even where the macOS menu bar handles `shortcut` */
	alternates?: readonly Hotkey[];
	/** Asks for more before it acts, so the macOS menu bar shows `…` after its label */
	ellipsis?: true;
	/** Whether this platform has it at all */
	available?: boolean;
	/** Its shortcut is handled where it's used instead of app-wide, and the menu bar doesn't show it */
	ownHotkey?: true;
	/** Left out of the macOS menu bar, whose shortcuts would take its keys from text fields, so its shortcut is handled here there too */
	notInMenuBar?: true;
	/** Leaves its shortcut to the browser and other handlers while it can't run */
	passThrough?: true;
	/** Text fields handle its shortcut themselves */
	ignoreInputs?: true;
	/** Whether it can run right now, the menu bar disables it and the command palette hides it otherwise */
	canRun?: (router: RegisteredRouter) => boolean;
	run: (router: RegisteredRouter) => void;
}

/** The web app only has the Alt versions of shortcuts browsers reserve, which the desktop app also keeps */
function reservedAlternate(hotkey: Hotkey): Hotkey[] {
	return desktop ? [hotkey] : [];
}

/** Every command with a shortcut, except ones with `ownHotkey` or `notInMenuBar`, must be in the macOS menu bar, which handles it there */
export const commands = {
	newWindow: {
		label: 'New window',
		icon: AppWindowIcon,
		shortcut: shortcuts.newWindow,
		available: desktop,
		run: newWindow,
	},
	newDashboard: {
		label: 'New dashboard',
		icon: PlusIcon,
		shortcut: shortcuts.newDashboard,
		alternates: reservedAlternate('Alt+T'),
		run: (router) => newDashboard(router),
	},
	close: {
		label: 'Close pane',
		icon: XIcon,
		keywords: desktop ? ['dashboard', 'window'] : ['dashboard'],
		shortcut: shortcuts.close,
		alternates: reservedAlternate('Alt+W'),
		canRun: (router) =>
			!isExportingVideo() && (desktop || (currentDashboard(router) ?? shownTuningDashboard(router)) !== undefined),
		run: closeFocused,
	},
	closeDashboard: {
		label: 'Close dashboard',
		icon: SquareXIcon,
		shortcut: shortcuts.closeDashboard,
		alternates: reservedAlternate('Alt+Shift+W'),
		canRun: (router) => currentDashboard(router) !== undefined,
		run: closeCurrentDashboard,
	},
	reopenDashboard: {
		label: 'Reopen closed dashboard',
		icon: HistoryIcon,
		shortcut: shortcuts.reopenDashboard,
		alternates: reservedAlternate('Alt+Shift+T'),
		canRun: () => closedStore.get().length > 0,
		run: reopenDashboard,
	},
	undo: {
		label: 'Undo',
		icon: Undo2Icon,
		shortcut: shortcuts.undo,
		ignoreInputs: true,
		canRun: (router) => canUndoOrRedo(router, 'undo'),
		run: (router) => undoOrRedo(router, 'undo'),
	},
	redo: {
		label: 'Redo',
		icon: Redo2Icon,
		shortcut: shortcuts.redo,
		alternates: redoAlternate === undefined ? [] : [redoAlternate],
		ignoreInputs: true,
		canRun: (router) => canUndoOrRedo(router, 'redo'),
		run: (router) => undoOrRedo(router, 'redo'),
	},
	update: {
		// Like its shortcut, it installs the update once one is found
		label: 'Check for updates',
		icon: RefreshCwIcon,
		keywords: ['install', 'version'],
		shortcut: shortcuts.update,
		ellipsis: true,
		run: () => void checkOrInstallUpdate(),
	},
	commandPalette: {
		label: 'Command palette',
		icon: SearchIcon,
		shortcut: shortcuts.commandPalette,
		ellipsis: true,
		run: toggleCommandPalette,
	},
	keyboardShortcuts: {
		label: 'Keyboard shortcuts',
		icon: KeyboardIcon,
		keywords: ['hotkeys', 'keybindings'],
		shortcut: shortcuts.keyboardShortcuts,
		run: toggleKeyboardShortcutsDialog,
	},
	back: {
		label: 'Back',
		icon: ArrowLeftIcon,
		shortcut: shortcuts.back,
		alternates: reservedAlternate('Alt+['),
		canRun: () => canGoInHistory(-1),
		run: (router) => goInHistory(router, -1),
	},
	forward: {
		label: 'Forward',
		icon: ArrowRightIcon,
		shortcut: shortcuts.forward,
		alternates: reservedAlternate('Alt+]'),
		canRun: () => canGoInHistory(1),
		run: (router) => goInHistory(router, 1),
	},
	logs: {
		label: 'Logs',
		icon: FolderSyncIcon,
		page: true,
		shortcut: shortcuts.logs,
		alternates: reservedAlternate('Alt+L'),
		run: openLogs,
	},
	tuning: {
		label: 'Tuning',
		icon: SlidersHorizontalIcon,
		page: true,
		run: (router) => void router.navigate({ to: '/tuning' }),
	},
	cloud: {
		label: 'Cloud',
		icon: CloudIcon,
		page: true,
		run: (router) => void router.navigate({ to: '/cloud' }),
	},
	settings: {
		label: 'Settings',
		icon: SettingsIcon,
		page: true,
		keywords: ['preferences'],
		shortcut: shortcuts.settings,
		alternates: reservedAlternate('Alt+,'),
		ellipsis: true,
		run: openSettings,
	},
	toggleSidebar: {
		label: 'Toggle sidebar',
		icon: PanelLeftIcon,
		shortcut: shortcuts.toggleSidebar,
		run: requestSidebarToggle,
	},
	toggleEntryBrowser: {
		label: 'Toggle entry browser',
		icon: PanelRightOpenIcon,
		shortcut: shortcuts.toggleEntryBrowser,
		passThrough: true,
		canRun: canToggleEntryBrowser,
		run: toggleDashboardEntryBrowser,
	},
	searchEntries: {
		label: 'Search entries',
		icon: TextSearchIcon,
		shortcut: shortcuts.searchEntries,
		// The entry browser handles it
		ownHotkey: true,
		canRun: canToggleEntryBrowser,
		run: focusEntrySearch,
	},
	findInConsole: {
		label: 'Find in Console',
		icon: TextSearchIcon,
		keywords: ['search', 'filter', 'messages'],
		shortcut: shortcuts.findInConsole,
		ellipsis: true,
		passThrough: true,
		canRun: canFindInConsole,
		run: findInConsole,
	},
	splitRight: {
		label: 'Split right',
		icon: Columns2Icon,
		shortcut: shortcuts.splitRight,
		canRun: (router) => canSplitFocused(router, 'row'),
		run: (router) => splitFocused(router, 'row'),
	},
	splitDown: {
		label: 'Split down',
		icon: Rows2Icon,
		shortcut: shortcuts.splitDown,
		canRun: (router) => canSplitFocused(router, 'column'),
		run: (router) => splitFocused(router, 'column'),
	},
	splitLeft: {
		label: 'Split left',
		icon: Columns2Icon,
		shortcut: shortcuts.splitLeft,
		// Selects text to the start of the line
		ignoreInputs: true,
		notInMenuBar: true,
		canRun: (router) => canSplitFocused(router, 'row'),
		run: (router) => splitFocused(router, 'row', true),
	},
	splitUp: {
		label: 'Split up',
		icon: Rows2Icon,
		shortcut: shortcuts.splitUp,
		// Selects text to the start of the field
		ignoreInputs: true,
		notInMenuBar: true,
		canRun: (router) => canSplitFocused(router, 'column'),
		run: (router) => splitFocused(router, 'column', true),
	},
	splitBestFit: {
		label: 'Split best fit',
		icon: LayoutGridPlusIcon,
		keywords: ['auto', 'automatic'],
		shortcut: shortcuts.splitBestFit,
		canRun: canSplitFocusedBestFit,
		run: splitFocusedBestFit,
	},
	balanceSplits: {
		label: 'Balance splits',
		icon: Columns3Icon,
		keywords: ['equalize', 'evenly', 'reset', 'resize', 'sizes'],
		canRun: canBalancePanes,
		run: balancePanes,
	},
	zoom: {
		label: 'Zoom or restore pane',
		icon: Maximize2Icon,
		keywords: ['maximize'],
		shortcut: shortcuts.zoom,
		canRun: canZoomFocused,
		run: toggleFocusedZoom,
	},
	zoomInPage: {
		label: 'Zoom in',
		icon: ZoomInIcon,
		shortcut: shortcuts.zoomInPage,
		// A shifted = can reach the webview as either = or +.
		alternates: ['Mod+Shift+=', 'Mod++'],
		available: desktop,
		run: () => zoomPage(1),
	},
	zoomOutPage: {
		label: 'Zoom out',
		icon: ZoomOutIcon,
		shortcut: shortcuts.zoomOutPage,
		available: desktop,
		run: () => zoomPage(-1),
	},
	resetPageZoom: {
		label: 'Actual size',
		icon: Maximize2Icon,
		keywords: ['reset', 'zoom', '100%'],
		shortcut: shortcuts.resetPageZoom,
		available: desktop,
		run: () => zoomPage(0),
	},
	editEntries: {
		label: 'Edit entries',
		icon: ListTodoIcon,
		shortcut: shortcuts.editEntries,
		canRun: canEditFocusedEntries,
		run: toggleFocusedEditing,
	},
	openLog: {
		label: 'Open log',
		icon: FolderOpenIcon,
		keywords: ['wpilog', 'file'],
		shortcut: shortcuts.openLog,
		ellipsis: true,
		run: chooseLog,
	},
	openLogUrl: {
		label: 'Open from URL',
		icon: GlobeIcon,
		keywords: ['log', 'link'],
		shortcut: shortcuts.openLogUrl,
		ellipsis: true,
		run: openLogUrlPrompt,
	},
	exportLive: {
		label: 'Export live data as WPILOG',
		icon: DownloadIcon,
		keywords: ['save'],
		shortcut: exportLiveShortcut,
		ellipsis: true,
		canRun: canExportLive,
		run: () => void exportLive(),
	},
	connect: {
		label: 'Connect',
		icon: RadioTowerIcon,
		keywords: ['robot', 'simulator', 'live', 'networktables'],
		shortcut: shortcuts.connect,
		run: startConnect,
	},
	copyDashboardLink: {
		label: 'Copy dashboard link',
		icon: LinkIcon,
		keywords: ['share', 'url'],
		shortcut: shortcuts.copyDashboardLink,
		passThrough: true,
		canRun: canCopyCurrentDashboard,
		run: (router) => {
			copyCurrentDashboardLink(router);
		},
	},
	copyDashboardImage: {
		label: 'Copy dashboard image',
		icon: ImageIcon,
		keywords: ['screenshot', 'capture'],
		shortcut: shortcuts.copyDashboardImage,
		available: canCapture,
		// ⌘C stays with Copy, which falls back to copying the dashboard's image
		ownHotkey: true,
		canRun: canCopyCurrentDashboard,
		run: copyCurrentDashboardImage,
	},
	exportVideo: {
		label: 'Export dashboard video',
		icon: VideoIcon,
		keywords: ['record', 'capture'],
		shortcut: shortcuts.exportVideo,
		ellipsis: true,
		available: canCapture,
		canRun: canExportCurrentDashboardVideo,
		run: exportCurrentDashboardVideo,
	},
} satisfies Record<string, AppCommand>;

export function canRunCommand(router: RegisteredRouter, command: AppCommand): boolean {
	return command.available !== false && (command.canRun?.(router) ?? true);
}

function commandHotkeys(router: RegisteredRouter, command: AppCommand): UseHotkeyDefinition[] {
	if (command.available === false || command.ownHotkey || command.shortcut === undefined) {
		return [];
	}
	const callback = (event: KeyboardEvent) => {
		if (canRunCommand(router, command)) {
			event.preventDefault();
			command.run(router);
		} else if (!command.passThrough) {
			event.preventDefault();
		}
	};
	const options = {
		preventDefault: false,
		stopPropagation: !command.passThrough,
		...(command.ignoreInputs ? { ignoreInputs: true } : {}),
	};
	return [
		// The macOS menu bar handles it there
		{
			hotkey: command.shortcut,
			callback,
			options: { ...options, enabled: !nativeMenu || command.notInMenuBar === true },
		},
		...(command.alternates ?? []).map((hotkey) => ({ hotkey, callback, options })),
	];
}

export function useGlobalShortcuts(): void {
	const router = useRouter();

	useHotkeys(
		[
			...Object.values<AppCommand>(commands).flatMap((command) => commandHotkeys(router, command)),
			...dashboardNumbers.flatMap((number) => [
				{ hotkey: `Alt+${number}` as const, callback: () => openDashboardAt(router, number - 1) },
				{
					hotkey: `Mod+${number}` as const,
					callback: () => openDashboardAt(router, number - 1),
					options: { enabled: desktop },
				},
			]),
		],
		{ requireReset: true },
	);
}
