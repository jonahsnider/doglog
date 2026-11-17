import { isTauri } from '@tauri-apps/api/core';
import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import { ChevronsUpDownIcon, DatabaseIcon, FileIcon, RadioTowerIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import {
	Menu,
	MenuItem,
	MenuPopup,
	MenuSeparator,
	MenuShortcut,
	MenuSub,
	MenuSubPopup,
	MenuSubTrigger,
	MenuTrigger,
} from '@/components/ui/menu';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { shortcuts, startConnect } from '@/commands/commands';
import { getEntry, useEntries } from '@/data/data-store';
import { clearRecentLogs, recentLogLabels, useRecentLogs } from '@/data/recent-logs';
import { chooseLog, type ConnectTarget, findConnectTarget, openLogPath, type Source, useSource } from '@/data/source';
import { cn } from '@/lib/utils';
import { getRobotHost } from '@/robot-target';
import { settingsStore } from '@/settings';
import { parseLogName, readLogMatch } from '@/sync/log-names';

const statusLabels: Record<Source['status'], string> = {
	loading: 'Loading…',
	loaded: 'Log file',
	connecting: 'Connecting…',
	connected: 'Connected',
	disconnected: 'Disconnected, reconnecting…',
};

/**
 * The source's state, with the match a loaded log is from, ex. `Log file for CAPH Q12`.
 * The log's Driver Station data is preferred, since people often rename logs when sharing them.
 */
function sourceStatus(source: Source): string {
	const match =
		source.status === 'loaded' && source.type === 'log'
			? (readLogMatch(getEntry) ?? parseLogName(source.fileName)?.match)
			: undefined;
	return match === undefined ? statusLabels[source.status] : `Log file for ${match.label}`;
}

const menuItems: MenuEntry[] = [
	{ label: 'Open log', shortcut: shortcuts.openLog, onSelect: chooseLog },
	'separator',
	{ label: 'Connect', shortcut: shortcuts.connect, onSelect: startConnect },
];

function SourceIcon({ source }: { source: Source | undefined }) {
	if (source?.status === 'loading' || source?.status === 'connecting') {
		return <Spinner />;
	}

	if (source === undefined) {
		return <DatabaseIcon />;
	}
	if (source.type === 'log') {
		return <FileIcon />;
	}
	return <RadioTowerIcon className={source.status === 'connected' ? 'text-success' : 'text-destructive-foreground'} />;
}

const connectLabels: Record<ConnectTarget, string> = { robot: 'Connect to robot', simulator: 'Connect to simulator' };

/** The desktop app's recent logs, the web app can't reopen files */
function OpenRecentMenu() {
	const paths = useRecentLogs();
	const labels = recentLogLabels(paths);
	return (
		<MenuSub>
			<MenuSubTrigger>Open recent</MenuSubTrigger>
			<MenuSubPopup className="max-w-80">
				{paths.map((path, index) => (
					<MenuItem key={path} title={path} onClick={() => void openLogPath(path)}>
						<span className="truncate">{labels[index]}</span>
					</MenuItem>
				))}
				{paths.length > 0 && <MenuSeparator />}
				<MenuItem disabled={paths.length === 0} onClick={clearRecentLogs}>
					Clear recent
				</MenuItem>
			</MenuSubPopup>
		</MenuSub>
	);
}

/** Shows the active data source and lets the user open a log or connect live */
export function SourceControl() {
	const source = useSource();
	// Re-render when the log's entries load, so its match is read
	useEntries();
	const formatForDisplay = useFormatForDisplay();
	const [connectTarget, setConnectTarget] = useState<ConnectTarget>();

	// Each check briefly connects to the NT server, so only check on mount (so the label is ready when the menu first opens) and when the menu opens.
	// The last result is shown until a check finishes.
	const checkConnectTarget = () => {
		void findConnectTarget(getRobotHost(settingsStore.get().robotTarget)).then(setConnectTarget);
	};
	useEffect(checkConnectTarget, []);

	const name = source === undefined ? 'No data source' : source.type === 'log' ? source.fileName : source.host;
	const status = source === undefined ? 'Open a log or connect' : sourceStatus(source);

	return (
		<AppContextMenu items={menuItems} render={<SidebarMenuItem />}>
			<Menu
				onOpenChange={(open) => {
					if (open) {
						checkConnectTarget();
					}
				}}
			>
				<MenuTrigger
					render={
						<SidebarMenuButton
							size="lg"
							// Keep the icon aligned and the height the same when only icons are shown
							className="group-data-[collapsible=icon]:h-12! group-data-[collapsible=icon]:p-2!"
							tooltip={`${name}: ${status}`}
						/>
					}
				>
					<SourceIcon source={source} />
					<div className="grid flex-1 text-left leading-tight">
						<span className="truncate font-medium">{name}</span>
						<span
							className={cn(
								'truncate text-xs text-muted-foreground',
								source?.status === 'disconnected' && 'text-destructive-foreground',
							)}
						>
							{status}
						</span>
					</div>
					<ChevronsUpDownIcon className="ms-auto text-muted-foreground" />
				</MenuTrigger>
				<MenuPopup align="start" className="w-(--anchor-width) min-w-56">
					<MenuItem onClick={chooseLog}>
						Open log
						<MenuShortcut>{formatForDisplay(shortcuts.openLog)}</MenuShortcut>
					</MenuItem>
					{isTauri() && <OpenRecentMenu />}
					<MenuSeparator />
					<MenuItem onClick={startConnect}>
						{connectTarget === undefined ? 'Connect' : connectLabels[connectTarget]}
						<MenuShortcut>{formatForDisplay(shortcuts.connect)}</MenuShortcut>
					</MenuItem>
				</MenuPopup>
			</Menu>
		</AppContextMenu>
	);
}
