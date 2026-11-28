import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Layout';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { join } from '@tauri-apps/api/path';
import { mkdir } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import FolderOpenIcon from 'lucide-react/icons/folder-open';
import FolderSyncIcon from 'lucide-react/icons/folder-sync';
import MonitorDownIcon from 'lucide-react/icons/monitor-down';
import PlayIcon from 'lucide-react/icons/play';
import { type ReactNode, useEffect, useState } from 'react';
import type { BoardLog } from '@/sync/sync-board';
import { SyncRow } from '@/sync/sync-row';
import { SyncSettingsDrawer } from '@/sync/sync-settings-drawer';
import { RobotRow } from '@/sync/sync-status';
import { PageEmptyState } from '@/components/page-empty-state';
import { UtilityPage } from '@/components/utility-page';
import { DownloadButton } from '@/desktop/download-button';
import { isMobileDevice } from '@/lib/mobile-layout';
import { openLogPaths } from '@/data/open-log';
import type { AddFiles } from '@/storage/add-files-dialog';
import { canReach, useCanReachStorage } from '@/storage/listing';
import { openRun } from '@/storage/open-run';
import { RunsSection, type RunsView, UploadButton } from '@/storage/runs-section';
import { useTeamStorage } from '@/storage/team-storage';
import { UploadRow } from '@/storage/upload-row';
import { type Run, groupRuns, runSquares } from '@/sync/runs';
import { type SyncFolder, usePlannedLogs, useSyncFolder, useSyncStatus } from '@/sync/sync';
import { updateSyncSettings, useSyncSettings } from '@/sync/sync-settings';

export const Route = createFileRoute('/logs')({
	component: Logs,
});

const dayMs = 24 * 60 * 60 * 1000;

const styles = stylex.create({
	// Side by side when there's room, see the log-sync spec's Logs page header
	rows: {
		display: 'grid',
		gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
		gap: spacingVars['--spacing-3'],
	},
});

/** The robot's row and the upload row */
function SyncRows({ children }: { children: ReactNode }) {
	return <div {...stylex.props(styles.rows)}>{children}</div>;
}

function Logs() {
	const storage = useTeamStorage();
	if (STUDIO_DESKTOP) {
		return <SyncOverview />;
	}
	if (storage && canReach(storage.connection)) {
		return <WebLogs />;
	}
	return (
		<PageEmptyState
			icon={<FolderSyncIcon />}
			title={storage ? 'Your team’s storage needs the desktop app' : 'Robot downloads need the desktop app'}
			description={
				storage
					? 'Browsers can’t reach your team’s storage, use the DogLog Studio desktop app instead.'
					: 'Browsers can’t download logs from your robot, use the DogLog Studio desktop app instead.'
			}
			actions={<DownloadButton />}
		/>
	);
}

/** The team's runs in the web app, which can't copy from the robot */
function WebLogs() {
	const navigate = useNavigate();
	const [view, setView] = useState<RunsView>('runs');
	const [adding, setAdding] = useState<AddFiles>();
	return (
		<UtilityPage title="Logs" actions={view === 'runs' && <UploadButton onAdd={setAdding} />}>
			<VStack gap={8}>
				<SyncRows>
					{/* Phones and tablets can't run the desktop app */}
					{!isMobileDevice() && (
						<SyncRow icon={MonitorDownIcon} title="Robot downloads need the desktop app">
							<DownloadButton size="sm" />
						</SyncRow>
					)}
					<UploadRow />
				</SyncRows>
				<RunsSection
					localRuns={[]}
					view={view}
					onView={setView}
					adding={adding}
					onAdd={setAdding}
					onOpen={(run) => {
						const open = async () => {
							await openRun(run);
							await navigate({ to: '/' });
						};
						void open();
					}}
				/>
			</VStack>
		</UtilityPage>
	);
}

/** Runs of the logs in the sync folder, apart from logs that are still being copied and aren't ready to open */
async function syncedRuns(folder: SyncFolder | undefined, unfinished: ReadonlySet<string>): Promise<Run[]> {
	const logs = (folder?.logs ?? []).filter((log) => !unfinished.has(log.name));
	return groupRuns(
		await Promise.all(
			logs.map(async (log) => ({ name: log.name, size: log.size, path: await join(folder!.path, log.dir, log.name) })),
		),
	);
}

function SyncOverview() {
	const status = useSyncStatus();
	const { enabled, days, demo } = useSyncSettings();
	const planned = usePlannedLogs();
	const folder = useSyncFolder();
	const storage = useTeamStorage();
	const reachable = useCanReachStorage();
	const navigate = useNavigate();
	const [view, setView] = useState<RunsView>('runs');
	const [adding, setAdding] = useState<AddFiles>();

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
	// Logs that are partly copied are in the folder, but aren't ready to open yet
	const unfinishedKey = boardLogs
		.filter((log) => log.state !== 'synced')
		.map((log) => log.name)
		.join('\n');
	const [localRuns, setLocalRuns] = useState<Run[]>([]);
	useEffect(() => {
		let current = true;
		const load = async () => {
			const found = await syncedRuns(folder, new Set(unfinishedKey.split('\n')));
			if (current) {
				setLocalRuns(found);
			}
		};
		void load();
		return () => {
			current = false;
		};
	}, [folder, unfinishedKey]);

	const { squares, members } = runSquares(boardLogs);
	const openSquare = async (name: string) => {
		// Demo logs aren't real files
		if (!folder || demo) {
			return;
		}
		const names = new Set(members.get(name) ?? [name]);
		const logs = folder.logs.filter((log) => names.has(log.name));
		await openLogPaths(await Promise.all(logs.map((log) => join(folder.path, log.dir, log.name))));
		void navigate({ to: '/' });
	};
	const open = async (run: Run) => {
		if (demo && run.logs.every((log) => log.stored === undefined)) {
			return;
		}
		await openRun(run);
		void navigate({ to: '/' });
	};

	const openFolder = async () => {
		if (!folder) {
			return;
		}
		const newest = localRuns[0]?.logs[0]?.path;
		if (newest === undefined) {
			await mkdir(folder.path, { recursive: true });
			await revealItemInDir(folder.path);
		} else {
			await revealItemInDir(newest);
		}
	};

	if (!enabled && (folder?.logs.length ?? 0) === 0 && !storage) {
		return (
			<PageEmptyState
				icon={<FolderSyncIcon />}
				title="Download logs from your robot"
				description="Studio downloads new logs while it’s open, and waits while the robot is enabled so it never slows it down."
				actions={
					<>
						<Button
							label="Start downloading"
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
					{reachable && view === 'runs' && <UploadButton onAdd={setAdding} />}
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
				<SyncRows>
					<RobotRow status={status} enabled={enabled} squares={squares} onOpen={(name) => void openSquare(name)} />
					<UploadRow />
				</SyncRows>
				<RunsSection
					localRuns={localRuns}
					view={view}
					onView={setView}
					adding={adding}
					onAdd={setAdding}
					onOpen={(run) => void open(run)}
				/>
			</VStack>
		</UtilityPage>
	);
}
