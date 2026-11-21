import { useFormatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import ChevronsUpDownIcon from 'lucide-react/icons/chevrons-up-down';
import { Fragment, useEffect, useId, useState } from 'react';
import { TextMorph } from 'torph/react';
import { AppContextMenu, type MenuAction, type MenuEntry } from '@/components/app-context-menu';
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
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { nativeMenu, shortcuts, startConnect } from '@/commands/commands';
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
import { canExportLive, exportLive, exportLiveShortcut } from '@/data/export-live';
import {
	closeLive,
	disconnect,
	type LiveSource,
	showSource,
	type Source,
	type Sources,
	useSources,
} from '@/data/source';
import { cn } from '@/lib/utils';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { settingsStore } from '@/settings';
import { SourceIcon } from '@/sidebar/source-icon';
import { liveColors, sourceLabels, statusLabels } from '@/sidebar/source-labels';
import { SourceSwitcher } from '@/sidebar/source-switcher';
import { matchIcons } from '@/sync/match-icons';

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

const connectLabels: Record<ConnectTarget, string> = {
	robot: 'Connect to robot',
	simulator: 'Connect to simulator',
};

const connectAction = (label: string): MenuAction => ({
	label,
	shortcut: shortcuts.connect,
	onSelect: startConnect,
});

/**
 * The export section of the source menu, shown once the live session has data, above the actions that end it.
 * Takes `live` so it's checked again when its status changes, the recording starts when it first connects.
 */
function exportActions(live: LiveSource | undefined): MenuAction[] {
	return live !== undefined && canExportLive()
		? [{ label: 'Export as WPILOG', shortcut: exportLiveShortcut, onSelect: () => void exportLive() }]
		: [];
}

/**
 * The live section of the source menu: connecting, disconnecting, or once disconnected, reconnecting or clearing the
 * data.
 * `backToLive` offers going back to a live session behind the log, for menus without the switcher.
 */
function liveActions(
	{ live, shown }: Sources,
	connectTarget: ConnectTarget | undefined,
	backToLive: boolean,
): MenuAction[] {
	if (live === undefined) {
		return [connectAction(connectTarget === undefined ? 'Connect' : connectLabels[connectTarget])];
	}
	const target = liveTarget(live) ?? 'live';
	if (live.status === 'disconnected') {
		// Connect switches to the other target when only it's reachable
		const label =
			connectTarget === undefined || isSourceTarget(live, connectTarget)
				? `Reconnect to ${target}`
				: connectLabels[connectTarget];
		return [connectAction(label), { label: 'Clear', onSelect: closeLive }];
	}
	return [
		...(backToLive && shown !== 'live' ? [connectAction(`Back to ${target}`)] : []),
		{ label: 'Disconnect', onSelect: disconnect },
	];
}

function SourceTrigger(sources: Sources) {
	const { state } = useSidebar();
	const descriptionId = useId();
	const { live, shown } = sources;
	const source = shown === undefined ? undefined : sources[shown];
	const { name, detail, matchType } = sourceLabels(source);
	const backgroundLive = shown === 'log' ? live : undefined;
	const liveDetail = backgroundLive && `Live: ${statusLabels[backgroundLive.status]}`;
	const fileName = source?.type === 'log' && source.fileName !== name ? source.fileName : undefined;
	const matchDetail = matchType && matchIcons[matchType].label;
	const description = [matchDetail, fileName, liveDetail].filter(Boolean).join('\n');
	const collapsed = state === 'collapsed';

	return (
		<Tooltip disabled={!collapsed && fileName === undefined}>
			<MenuTrigger
				aria-describedby={description ? descriptionId : undefined}
				render={
					<TooltipTrigger
						render={
							<SidebarMenuButton
								size="lg"
								// Keep the icon aligned and the height the same when only icons are shown
								className="group-data-[collapsible=icon]:h-12! group-data-[collapsible=icon]:p-2!"
							/>
						}
					/>
				}
			>
				<ShownSourceIcon source={source} backgroundLive={backgroundLive} />
				<div className="grid min-w-0 flex-1 text-left leading-tight">
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
						{detail}
					</TextMorph>
				</div>
				<ChevronsUpDownIcon className="ms-auto text-muted-foreground" />
			</MenuTrigger>
			{description && (
				<span hidden id={descriptionId}>
					{description}
				</span>
			)}
			<TooltipPopup aria-hidden side="right" className="max-w-80 wrap-anywhere whitespace-pre-line">
				{collapsed && <div>{`${name}: ${detail}`}</div>}
				{description}
			</TooltipPopup>
		</Tooltip>
	);
}

function ActionItem({ action }: { action: MenuAction }) {
	const formatForDisplay = useFormatForDisplay();
	return (
		<MenuItem onClick={action.onSelect}>
			{action.label}
			{action.shortcut !== undefined && <MenuShortcut>{formatForDisplay(action.shortcut)}</MenuShortcut>}
		</MenuItem>
	);
}

function OpenRecentMenu() {
	const savedPaths = useRecentLogs();
	// Only the desktop app can open paths, ignore any saved on the web
	const paths = STUDIO_DESKTOP ? savedPaths : [];
	const handles = useRecentLogHandles();
	const labels = recentLogLabels(paths);
	const empty = paths.length === 0 && handles.length === 0;
	return (
		<MenuSub>
			<MenuSubTrigger>Open recent</MenuSubTrigger>
			<MenuSubPopup className="max-w-80">
				{STUDIO_DESKTOP &&
					paths.map((path, index) => (
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

export function SourceControl() {
	const sources = useSources();
	// Re-render when the log's entries load, so its match is read
	useEntries();
	const formatForDisplay = useFormatForDisplay();
	const [connectTarget, setConnectTarget] = useState<ConnectTarget>();
	// The native menu handles it on macOS
	useHotkey(exportLiveShortcut, () => void exportLive(), { enabled: !nativeMenu, requireReset: true });

	// Each check briefly connects to the NT server, so only check on mount (so the label is ready when the menu first opens) and when the menu opens.
	// The last result is shown until a check finishes.
	const checkConnectTarget = () => {
		void findConnectTarget(getRobotHost(settingsStore.get().robotTarget)).then(setConnectTarget);
	};
	useEffect(checkConnectTarget, []);

	const { log, live, shown } = sources;
	const menuItems: MenuEntry[] = [
		...(shown === 'live' && log
			? [
					{
						label: `Back to ${sourceLabels(log).name}`,
						shortcut: shortcuts.switchSource,
						onSelect: () => showSource('log'),
					},
				]
			: []),
		{ label: 'Open log', shortcut: shortcuts.openLog, onSelect: chooseLog },
		'separator',
		...exportActions(live).flatMap((action): MenuEntry[] => [action, 'separator']),
		...liveActions(sources, connectTarget, true),
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
				<SourceTrigger {...sources} />
				<MenuPopup align="start" className="w-(--anchor-width) min-w-56">
					{live && log && (
						<>
							<SourceSwitcher live={live} log={log} shown={shown} />
							<MenuSeparator />
						</>
					)}
					<MenuItem onClick={chooseLog}>
						Open log
						<MenuShortcut>{formatForDisplay(shortcuts.openLog)}</MenuShortcut>
					</MenuItem>
					{(STUDIO_DESKTOP || supportsFileHandles) && <OpenRecentMenu />}
					<MenuSeparator />
					{exportActions(live).map((action) => (
						<Fragment key={action.label}>
							<ActionItem action={action} />
							<MenuSeparator />
						</Fragment>
					))}
					{/* The switcher goes back to the live session */}
					{liveActions(sources, connectTarget, false).map((action) => (
						<ActionItem key={action.label} action={action} />
					))}
				</MenuPopup>
			</Menu>
		</AppContextMenu>
	);
}
