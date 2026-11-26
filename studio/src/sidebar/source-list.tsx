import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { IconButton } from '@astryxdesign/core/IconButton';
import { typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useHotkey } from '@tanstack/react-hotkeys';
import PlusIcon from 'lucide-react/icons/plus';
import { useEffect, useRef, useState } from 'react';
import { MenuEntries, type MenuAction, type MenuEntry } from '@/components/app-context-menu';
import { nativeMenu, openLogUrlPrompt, shortcuts, startConnect } from '@/commands/commands';
import { useVisibleEntries } from '@/data/data-store';
import { type ConnectTarget, findConnectTarget, isSourceTarget } from '@/data/connect-target';
import { canExportLive, exportLive, exportLiveShortcut } from '@/data/export-live';
import { chooseLog } from '@/data/open-log';
import { supportsFileHandles } from '@/data/recent-logs';
import {
	closeLive,
	closeLog,
	disconnect,
	type LiveSource,
	sourceList,
	useSources,
	visibleSources,
} from '@/data/source';
import { lineUpLog, lineUpWithLatestEnable } from '@/data/source-line-up';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { settingsStore } from '@/settings';
import { setSourceListElement } from '@/desktop/source-windows';
import { useMoveToEntry } from '@/sidebar/move-source';
import { useOpenRecentEntry } from '@/sidebar/open-recent-menu';
import { SectionLabel } from '@/sidebar/section-label';
import { useSidebar } from '@/sidebar/sidebar-context';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/sidebar/sidebar-ui';
import { SourceIcon } from '@/sidebar/source-icon';
import { SourceOffset } from '@/sidebar/source-offset';
import { SourceLabels, SourceRow } from '@/sidebar/source-row';
import { sectionLabelMarker } from './markers.stylex';

/** How many sources the rail shows before "+N" */
const railSources = 4;

const styles = stylex.create({
	sectionAction: {
		marginInlineStart: 'auto',
		opacity: {
			default: 1,
			'@media (hover: hover)': {
				default: 0,
				':is([aria-expanded=true])': 1,
				[stylex.when.ancestor(':hover', sectionLabelMarker)]: 1,
				[stylex.when.ancestor(':focus-within', sectionLabelMarker)]: 1,
			},
		},
	},
	// Drawn as an icon, since the rail only shows icons
	more: {
		overflow: 'visible',
		fontSize: typeScaleVars['--text-supporting-size'],
		fontWeight: 500,
	},
});

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

/** Checks what Connect would connect to, which briefly connects to the NT server, so only when a menu opens */
function useConnectTarget() {
	const [target, setTarget] = useState<ConnectTarget>();
	const check = () => {
		void findConnectTarget(getRobotHost(settingsStore.get().robotTarget)).then(setTarget);
	};
	// On mount, so the label is ready when the menu first opens
	useEffect(check, []);
	return { target, check };
}

/** The live session's menu: exporting once it has data, then connecting, disconnecting, or clearing the data */
function liveItems(live: LiveSource, connectTarget: ConnectTarget | undefined, hasLogs: boolean): MenuEntry[] {
	const items: MenuEntry[] = [];
	if (canExportLive()) {
		items.push(
			{ label: 'Export as WPILOG', shortcut: exportLiveShortcut, onSelect: () => void exportLive() },
			'separator',
		);
	}
	const target = liveTarget(live) ?? 'live';
	if (live.status === 'disconnected') {
		// Connect switches to the other target when only it's reachable
		const label =
			connectTarget === undefined || isSourceTarget(live, connectTarget)
				? `Reconnect to ${target}`
				: connectLabels[connectTarget];
		items.push(connectAction(label), { label: 'Clear', onSelect: closeLive });
	} else {
		items.push({ label: 'Disconnect', onSelect: disconnect });
	}
	if (hasLogs) {
		items.push('separator', { label: 'Line up logs with latest enable', onSelect: () => lineUpWithLatestEnable() });
	}
	return items;
}

/** One row per source at the top of the sidebar, growing with each one, see the data-sources spec's source list */
export function SourceList({ onShow }: { onShow: () => void }) {
	const sources = useSources();
	// Re-render when logs' entries load, so their matches are read
	useVisibleEntries();
	const { collapsed } = useSidebar();
	const connect = useConnectTarget();
	const openRecent = useOpenRecentEntry();
	const moveTo = useMoveToEntry();
	const listRef = useRef<HTMLUListElement>(null);
	useEffect(() => {
		setSourceListElement(listRef.current);
		return () => setSourceListElement(null);
	}, []);
	// The native menu handles it on macOS
	useHotkey(exportLiveShortcut, () => void exportLive(), { enabled: !nativeMenu, requireReset: true });

	const { live, logs } = sources;
	const checkOnOpen = (open: boolean) => {
		if (open) {
			connect.check();
		}
	};
	const list = sourceList(sources);
	const visible = visibleSources(sources);
	const addItems: MenuEntry[] = [
		{ label: 'Open log', shortcut: shortcuts.openLog, onSelect: chooseLog },
		{ label: 'Open from URL…', shortcut: shortcuts.openLogUrl, onSelect: openLogUrlPrompt },
		...(STUDIO_DESKTOP || supportsFileHandles ? [openRecent] : []),
		...(live === undefined
			? ['separator' as const, connectAction(connect.target === undefined ? 'Connect' : connectLabels[connect.target])]
			: []),
	];

	const shown = collapsed ? list.slice(0, list.length > railSources ? railSources - 1 : railSources) : list;
	return (
		<>
			<SectionLabel label="Sources">
				<DropdownMenu
					alignment="end"
					onOpenChange={checkOnOpen}
					renderTrigger={(trigger) => (
						<IconButton
							{...trigger}
							label="Add a source"
							tooltip="Add a source"
							icon={<PlusIcon />}
							variant="ghost"
							size="sm"
							xstyle={styles.sectionAction}
						/>
					)}
				>
					<MenuEntries items={addItems} />
				</DropdownMenu>
			</SectionLabel>
			<SidebarMenu ref={listRef}>
				{list.length === 0 && (
					<SidebarMenuItem>
						<DropdownMenu
							menuWidth={224}
							onOpenChange={checkOnOpen}
							renderTrigger={(trigger) => (
								<SidebarMenuButton {...trigger} size="lg" tooltip="No data source">
									<SourceIcon source={undefined} />
									<SourceLabels name="No data source" detail="Open a log or connect" />
								</SidebarMenuButton>
							)}
						>
							<MenuEntries items={addItems} />
						</DropdownMenu>
					</SidebarMenuItem>
				)}
				{shown.map((source) => {
					const index = visible.indexOf(source);
					const move = moveTo(source);
					if (source.type === 'live') {
						return (
							<SourceRow
								key="live"
								source={source}
								visibleIndex={index === -1 ? undefined : index}
								logIndex={undefined}
								list={listRef}
								menuItems={[
									...liveItems(source, connect.target, logs.length > 0),
									...(move === undefined ? [] : ['separator' as const, move]),
								]}
								onOpenChange={checkOnOpen}
							/>
						);
					}
					const items: MenuEntry[] = [
						...(source.manualOffset === true
							? [{ label: 'Line up automatically', onSelect: () => lineUpLog(source.id) }, 'separator' as const]
							: []),
						...(move === undefined ? [] : [move, 'separator' as const]),
						{ label: 'Close log', onSelect: () => closeLog(source.id) },
					];
					return (
						<SourceRow
							key={source.id}
							source={source}
							visibleIndex={index === -1 ? undefined : index}
							logIndex={logs.indexOf(source)}
							list={listRef}
							menuItems={items}
							header={source.status === 'loaded' && <SourceOffset id={source.id} />}
						/>
					);
				})}
				{shown.length < list.length && (
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip={`${list.length - shown.length} more sources`}
							aria-label={`Show ${list.length - shown.length} more sources`}
							onClick={onShow}
						>
							<svg aria-hidden viewBox="0 0 16 16" {...stylex.props(styles.more)}>
								<text x={8} y={12} textAnchor="middle" fill="currentColor">
									+{list.length - shown.length}
								</text>
							</svg>
						</SidebarMenuButton>
					</SidebarMenuItem>
				)}
			</SidebarMenu>
		</>
	);
}
