import { DropdownMenu, type DropdownMenuTriggerProps } from '@astryxdesign/core/DropdownMenu';
import { colorVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import { useHotkey } from '@tanstack/react-hotkeys';
import ChevronsUpDownIcon from 'lucide-react/icons/chevrons-up-down';
import { useEffect, useState } from 'react';
import { AppContextMenu, MenuEntries, type MenuAction, type MenuEntry } from '@/components/app-context-menu';
import { TextMorph } from '@/components/text-morph';
import { nativeMenu, openLogUrlPrompt, shortcuts, startConnect } from '@/commands/commands';
import { useEntries } from '@/data/data-store';
import { supportsFileHandles } from '@/data/recent-logs';
import { chooseLog } from '@/data/open-log';
import { type ConnectTarget, findConnectTarget, isSourceTarget } from '@/data/connect-target';
import { canExportLive, exportLive, exportLiveShortcut } from '@/data/export-live';
import {
	closeLive,
	closeLog,
	disconnect,
	type LiveSource,
	showSource,
	type Source,
	type Sources,
	useSources,
} from '@/data/source';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { settingsStore } from '@/settings';
import { useOpenRecentEntry } from '@/sidebar/open-recent-menu';
import { useSidebar } from '@/sidebar/sidebar-context';
import { SidebarMenuButton, SidebarMenuItem } from '@/sidebar/sidebar-ui';
import { SourceIcon } from '@/sidebar/source-icon';
import { liveColors, sourceLabels, statusLabels } from '@/sidebar/source-labels';
import { SourceSwitcher } from '@/sidebar/source-switcher';
import { matchIcons } from '@/sync/match-icons';

const styles = stylex.create({
	icon: {
		position: 'relative',
		display: 'flex',
		flexShrink: 0,
		width: 16,
		height: 16,
	},
	liveDot: (color: string) => ({
		position: 'absolute',
		insetInlineEnd: -2,
		bottom: -2,
		width: 6,
		height: 6,
		borderRadius: '50%',
		backgroundColor: color,
		boxShadow: `0 0 0 1px ${colorVars['--color-background-body']}`,
	}),
	labels: {
		display: 'grid',
		flex: 1,
		minWidth: 0,
		lineHeight: 1.25,
		textAlign: 'start',
	},
	name: {
		overflow: 'hidden',
		fontWeight: 500,
		textOverflow: 'ellipsis',
	},
	detail: {
		overflow: 'hidden',
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		textOverflow: 'ellipsis',
	},
	reconnecting: {
		color: colorVars['--color-text-error'],
	},
	chevron: {
		flexShrink: 0,
		width: 16,
		height: 16,
		marginInlineStart: 'auto',
		color: colorVars['--color-icon-secondary'],
	},
	tooltip: {
		maxWidth: 320,
		overflowWrap: 'anywhere',
		whiteSpace: 'pre-line',
	},
});

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
		<span {...stylex.props(styles.icon)}>
			<SourceIcon source={source} />
			<span aria-hidden {...stylex.props(styles.liveDot(liveColors[backgroundLive.status]))} />
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

function SourceTrigger({ sources, trigger }: { sources: Sources; trigger: DropdownMenuTriggerProps }) {
	const { collapsed } = useSidebar();
	const { live, shown } = sources;
	const source = shown === undefined ? undefined : sources[shown];
	const { name, detail, matchType } = sourceLabels(source);
	const backgroundLive = shown === 'log' ? live : undefined;
	const liveDetail = backgroundLive && `Live: ${statusLabels[backgroundLive.status]}`;
	const fileName = source?.type === 'log' && source.fileName !== name ? source.fileName : undefined;
	const matchDetail = matchType && matchIcons[matchType].label;
	const description = [collapsed ? `${name}: ${detail}` : undefined, matchDetail, fileName, liveDetail]
		.filter(Boolean)
		.join('\n');

	return (
		<Tooltip
			// The tooltip can still be visible while the sidebar starts peeking.
			content={<span {...stylex.props(styles.tooltip)}>{description || `${name}: ${detail}`}</span>}
			placement="end"
			isEnabled={collapsed || fileName !== undefined}
		>
			<SidebarMenuButton {...trigger} size="lg">
				<ShownSourceIcon source={source} backgroundLive={backgroundLive} />
				<span {...stylex.props(styles.labels)}>
					{/* Numbers are off so addresses aren't morphed like decimals */}
					<TextMorph as="span" numbers={false} {...stylex.props(styles.name)}>
						{name}
					</TextMorph>
					<TextMorph
						as="span"
						numbers={false}
						{...stylex.props(styles.detail, source?.status === 'reconnecting' && styles.reconnecting)}
					>
						{detail}
					</TextMorph>
				</span>
				<ChevronsUpDownIcon {...stylex.props(styles.chevron)} />
			</SidebarMenuButton>
		</Tooltip>
	);
}

const closeLogAction: MenuAction = { label: 'Close log', onSelect: closeLog };

export function SourceControl() {
	const sources = useSources();
	// Re-render when the log's entries load, so its match is read
	useEntries();
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
		{ label: 'Open from URL…', shortcut: shortcuts.openLogUrl, onSelect: openLogUrlPrompt },
		...(log ? [closeLogAction] : []),
		'separator',
		...exportActions(live).flatMap((action): MenuEntry[] => [action, 'separator']),
		...liveActions(sources, connectTarget, true),
	];

	const openRecent = useOpenRecentEntry();
	const dropdownItems: MenuEntry[] = [
		{ label: 'Open log', shortcut: shortcuts.openLog, onSelect: chooseLog },
		{ label: 'Open from URL…', shortcut: shortcuts.openLogUrl, onSelect: openLogUrlPrompt },
		...(STUDIO_DESKTOP || supportsFileHandles ? [openRecent] : []),
		...(log && !live ? [closeLogAction] : []),
		'separator',
		...exportActions(live).flatMap((action): MenuEntry[] => [action, 'separator']),
		// The switcher goes back to the live session
		...liveActions(sources, connectTarget, false),
	];

	return (
		<SidebarMenuItem>
			<AppContextMenu items={menuItems} label="Source actions">
				<DropdownMenu
					menuWidth={224}
					header={live && log && <SourceSwitcher live={live} log={log} shown={shown} />}
					onOpenChange={(open) => {
						if (open) {
							checkConnectTarget();
						}
					}}
					renderTrigger={(trigger) => <SourceTrigger sources={sources} trigger={trigger} />}
				>
					<MenuEntries items={dropdownItems} />
				</DropdownMenu>
			</AppContextMenu>
		</SidebarMenuItem>
	);
}
