import { isTauri } from '@tauri-apps/api/core';
import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import { ChevronsUpDownIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TextMorph } from 'torph/react';
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
import { shortcuts, startConnect } from '@/commands/commands';
import { useEntries } from '@/data/data-store';
import {
	clearRecentLogs,
	recentLogLabels,
	supportsFileHandles,
	useRecentLogHandles,
	useRecentLogs,
} from '@/data/recent-logs';
import { chooseLog, openLogPath, openRecentLogHandle } from '@/data/open-log';
import { type ConnectTarget, findConnectTarget, isSourceTarget } from '@/data/connect-target';
import {
	disconnect,
	type LiveSource,
	resetLive,
	showSource,
	type Source,
	type Sources,
	useSources,
} from '@/data/source';
import { cn } from '@/lib/utils';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { settingsStore } from '@/settings';
import { SourceIcon } from '@/sidebar/source-icon';
import { liveColors, sourceName, sourceStatus, statusLabels } from '@/sidebar/source-labels';
import { SourceSwitcher } from '@/sidebar/source-switcher';

/** The shown source's icon, with a dot for the live session's status while it runs behind the log */
function ShownSourceIcon({
	source,
	backgroundLive,
}: {
	source: Source | undefined;
	backgroundLive: LiveSource | undefined;
}) {
	if (backgroundLive === undefined) {
		return <SourceIcon source={source} />;
	}
	return (
		<span className="relative flex shrink-0">
			<SourceIcon source={source} />
			<span
				className={cn(
					'absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-sidebar',
					liveColors[backgroundLive.status].background,
				)}
			/>
		</span>
	);
}

/** What the live session is connected to, `undefined` while it's still looking for the robot or simulator */
function liveTarget(live: LiveSource): ConnectTarget | undefined {
	if (live.status === 'connecting' && live.host.includes(' or ')) {
		return undefined;
	}
	return live.host === simulatorHost ? 'simulator' : 'robot';
}

const connectLabels: Record<ConnectTarget, string> = { robot: 'Connect to robot', simulator: 'Connect to simulator' };

/** The Connect action, which goes back to the live session while a log is shown */
function connectAction({ live, shown }: Sources, connectTarget: ConnectTarget | undefined) {
	if (live && shown !== 'live') {
		return { label: `Back to ${liveTarget(live) ?? 'live'}`, disabled: false };
	}
	// Connecting again would connect to the same server, so it's only offered when it reconnects or switches to another one
	if (live && isSourceTarget(live, connectTarget)) {
		const target = liveTarget(live);
		if (live.status === 'disconnected') {
			return { label: `Reconnect to ${target}`, disabled: false };
		}
		return {
			label: live.status === 'connected' ? `Connected to ${target}` : `Reconnecting to ${target}…`,
			disabled: true,
		};
	}
	return { label: connectTarget === undefined ? 'Connect' : connectLabels[connectTarget], disabled: false };
}

/** The shown source's name and status, and the live session's while it runs behind the log */
function sourceSummary({ log, live, shown }: Sources) {
	const source = shown === 'log' ? log : shown === 'live' ? live : undefined;
	const name = source === undefined ? 'No data source' : sourceName(source);
	const status = source === undefined ? 'Open a log or connect' : sourceStatus(source);
	const backgroundLive = shown === 'log' ? live : undefined;
	const tooltip = `${name}: ${status}${backgroundLive ? `, live: ${statusLabels[backgroundLive.status]}` : ''}`;
	return { source, name, status, backgroundLive, tooltip };
}

function SourceLabel({ sources }: { sources: Sources }) {
	const { source, name, status, backgroundLive } = sourceSummary(sources);
	return (
		<>
			<ShownSourceIcon source={source} backgroundLive={backgroundLive} />
			<div className="grid flex-1 text-left leading-tight">
				{/* Numbers are off so addresses aren't morphed like decimals */}
				<TextMorph as="span" className="truncate font-medium" numbers={false}>
					{name}
				</TextMorph>
				<TextMorph
					as="span"
					numbers={false}
					className={cn(
						'truncate text-xs text-muted-foreground',
						source?.status === 'reconnecting' && 'text-destructive-foreground',
					)}
				>
					{status}
				</TextMorph>
			</div>
		</>
	);
}

/** What the source menu offers for the window's log and live session */
function sourceActions(sources: Sources, connectTarget: ConnectTarget | undefined) {
	const { log, live, shown } = sources;
	return {
		backToLog: shown === 'live' && log ? `Back to ${log.fileName}` : undefined,
		connect: connectAction(sources, connectTarget),
		// The switcher goes back to the live session, so Connect acts as it would while live is shown
		menuConnect: connectAction({ ...sources, shown: live && log ? 'live' : shown }, connectTarget),
		canDisconnect: live !== undefined && live.status !== 'disconnected',
		canReset: live !== undefined && live.status !== 'connecting',
	};
}

/** The recent logs, from paths in the desktop app or file handles in the web app */
function OpenRecentMenu() {
	const savedPaths = useRecentLogs();
	// Only the desktop app can open paths, ignore any saved on the web
	const paths = isTauri() ? savedPaths : [];
	const handles = useRecentLogHandles();
	const labels = recentLogLabels(paths);
	const empty = paths.length === 0 && handles.length === 0;
	return (
		<MenuSub>
			<MenuSubTrigger>Open recent</MenuSubTrigger>
			<MenuSubPopup className="max-w-80">
				{paths.map((path, index) => (
					<MenuItem key={path} title={path} onClick={() => void openLogPath(path)}>
						<span className="truncate">{labels[index]}</span>
					</MenuItem>
				))}
				{handles.map((recent) => (
					<MenuItem key={recent.id} onClick={() => void openRecentLogHandle(recent.handle)}>
						<span className="truncate">{recent.handle.name}</span>
					</MenuItem>
				))}
				{!empty && <MenuSeparator />}
				<MenuItem disabled={empty} onClick={clearRecentLogs}>
					Clear recent
				</MenuItem>
			</MenuSubPopup>
		</MenuSub>
	);
}

/** Shows the active data source and lets the user open a log or connect live */
export function SourceControl() {
	const sources = useSources();
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

	const {
		backToLog,
		connect: connectItem,
		menuConnect,
		canDisconnect,
		canReset,
	} = sourceActions(sources, connectTarget);
	const menuItems: MenuEntry[] = [
		...(backToLog === undefined ? [] : [{ label: backToLog, onSelect: () => showSource('log') }, 'separator' as const]),
		{ label: 'Open log', shortcut: shortcuts.openLog, onSelect: chooseLog },
		'separator',
		{ label: connectItem.label, shortcut: shortcuts.connect, disabled: connectItem.disabled, onSelect: startConnect },
		...(canDisconnect ? [{ label: 'Disconnect', onSelect: disconnect }] : []),
		...(canReset ? [{ label: 'Reset', onSelect: resetLive }] : []),
	];

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
							tooltip={sourceSummary(sources).tooltip}
						/>
					}
				>
					<SourceLabel sources={sources} />
					<ChevronsUpDownIcon className="ms-auto text-muted-foreground" />
				</MenuTrigger>
				<MenuPopup align="start" className="w-(--anchor-width) min-w-56">
					{sources.live && sources.log && (
						<SourceSwitcher live={sources.live} log={sources.log} shown={sources.shown} />
					)}
					<MenuItem onClick={chooseLog}>
						Open log
						<MenuShortcut>{formatForDisplay(shortcuts.openLog)}</MenuShortcut>
					</MenuItem>
					{(isTauri() || supportsFileHandles) && <OpenRecentMenu />}
					<MenuSeparator />
					<MenuItem disabled={menuConnect.disabled} onClick={startConnect}>
						{menuConnect.label}
						<MenuShortcut>{formatForDisplay(shortcuts.connect)}</MenuShortcut>
					</MenuItem>
					{canDisconnect && <MenuItem onClick={disconnect}>Disconnect</MenuItem>}
					{canReset && <MenuItem onClick={resetLive}>Reset</MenuItem>}
				</MenuPopup>
			</Menu>
		</AppContextMenu>
	);
}
