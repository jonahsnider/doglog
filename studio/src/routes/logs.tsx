import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { join } from '@tauri-apps/api/path';
import { mkdir } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import FolderOpenIcon from 'lucide-react/icons/folder-open';
import FolderSyncIcon from 'lucide-react/icons/folder-sync';
import PlayIcon from 'lucide-react/icons/play';
import { type BoardLog, SyncBoard } from '@/sync/sync-board';
import { SyncSettingsDrawer } from '@/sync/sync-settings-drawer';
import { SyncStatusPanel } from '@/sync/sync-status';
import { PageEmptyState } from '@/components/page-empty-state';
import { UtilityPage } from '@/components/utility-page';
import { DownloadButton } from '@/desktop/download-button';
import { openLogPath } from '@/data/open-log';
import { dateTimeFormat, logLabel, formatSize } from '@/sync/format';
import { compareLogNames, parseLogName } from '@/sync/log-names';
import { matchIcons } from '@/sync/match-icons';
import { type SyncFolder, usePlannedLogs, useSyncFolder, useSyncStatus } from '@/sync/sync';
import { updateSyncSettings, useSyncSettings } from '@/sync/sync-settings';

export const Route = createFileRoute('/logs')({
	component: Logs,
});

const styles = stylex.create({
	iconSpace: { display: 'block', width: spacingVars['--spacing-4'] },
});

const dayMs = 24 * 60 * 60 * 1000;
const recentCount = 5;

function Logs() {
	if (!STUDIO_DESKTOP) {
		return (
			<PageEmptyState
				icon={<FolderSyncIcon />}
				title="Log sync needs the desktop app"
				description="Browsers can’t copy logs from your robot, use the DogLog Studio desktop app instead."
				actions={<DownloadButton />}
			/>
		);
	}

	return <SyncOverview />;
}

function syncedLogs(folder: SyncFolder | undefined) {
	return (folder?.logs ?? [])
		.flatMap((log) => {
			const parsed = parseLogName(log.name);
			return parsed ? [{ ...log, ...parsed }] : [];
		})
		.toSorted((a, b) => b.date.getTime() - a.date.getTime() || compareLogNames(b.name, a.name));
}

function SyncOverview() {
	const status = useSyncStatus();
	const { enabled, days, demo } = useSyncSettings();
	const planned = usePlannedLogs();
	const folder = useSyncFolder();
	const navigate = useNavigate();

	const saved = new Map(folder?.logs.map((log) => [log.name, log.size]));
	const since = planned.at - days * dayMs;
	const boardLogs = planned.logs
		.filter((log) => log.date >= since)
		.map((log): BoardLog => {
			const copying = status.type === 'syncing' && status.file === log.name;
			const savedBytes = copying ? status.fileSaved : (saved.get(log.name) ?? 0);
			let state: BoardLog['state'] = 'queued';
			if (log.state === 'over-limit') {
				state = 'over-limit';
			} else if (copying) {
				state = 'copying';
			} else if (savedBytes >= log.size) {
				state = 'synced';
			}
			// A log the robot is still writing can grow past the size it had when sync checked
			return { name: log.name, date: log.date, size: Math.max(log.size, savedBytes), saved: savedBytes, state };
		});
	const synced = syncedLogs(folder);
	// Logs that are partly copied are in the folder, but aren't ready to open yet
	const unfinished = new Set(boardLogs.filter((log) => log.state !== 'synced').map((log) => log.name));
	const recent = synced.filter((log) => !unfinished.has(log.name)).slice(0, recentCount);

	const open = async (name: string) => {
		// Demo logs aren't real files
		if (folder && !demo) {
			await openLogPath(await join(folder.path, name));
			void navigate({ to: '/' });
		}
	};

	const openFolder = async () => {
		if (!folder) {
			return;
		}
		const newest = synced[0];
		if (newest) {
			await revealItemInDir(await join(folder.path, newest.name));
		} else {
			await mkdir(folder.path, { recursive: true });
			await revealItemInDir(folder.path);
		}
	};

	if (!enabled && synced.length === 0) {
		return (
			<PageEmptyState
				icon={<FolderSyncIcon />}
				title="Copy logs from your robot"
				description="While Studio is open, new logs are copied over the robot’s network connection. Sync waits while the robot is enabled so it never slows it down."
				actions={
					<>
						<Button
							label="Start syncing"
							variant="primary"
							icon={<PlayIcon />}
							onClick={() => updateSyncSettings({ enabled: true, started: true })}
						/>
						<SyncSettingsDrawer />
					</>
				}
			/>
		);
	}

	return (
		<UtilityPage
			title="Logs"
			actions={
				<>
					<Button
						label="Open folder"
						variant="ghost"
						size="sm"
						icon={<FolderOpenIcon />}
						onClick={() => void openFolder()}
					/>
					<SyncSettingsDrawer />
				</>
			}
		>
			<VStack gap={8}>
				<VStack gap={8}>
					<SyncStatusPanel status={status} enabled={enabled} boardLogs={boardLogs} days={days} />
					{boardLogs.length > 0 && <SyncBoard logs={boardLogs} onOpen={(name) => void open(name)} />}
				</VStack>

				{recent.length > 0 && (
					<List header="Recent logs" density="compact" edge="outset">
						{recent.map((log) => {
							const matchIcon = log.match === undefined ? undefined : matchIcons[log.match.type];
							return (
								<ListItem
									key={log.name}
									// Logs from outside a match have no icon, like on the board
									startContent={
										matchIcon ? (
											<matchIcon.icon aria-label={matchIcon.label} size={16} />
										) : (
											<span {...stylex.props(styles.iconSpace)} />
										)
									}
									label={logLabel(log.name)}
									endContent={
										<Text type="supporting" color="secondary" hasTabularNumbers>
											{log.match !== undefined && `${dateTimeFormat.format(log.date)} · `}
											{formatSize(log.size)}
										</Text>
									}
									onClick={() => void open(log.name)}
								/>
							);
						})}
					</List>
				)}
			</VStack>
		</UtilityPage>
	);
}
