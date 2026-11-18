import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { isTauri } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { mkdir } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { FolderOpenIcon, FolderSyncIcon, PlayIcon, SettingsIcon } from 'lucide-react';
import { type BoardLog, SyncBoard } from '@/sync/sync-board';
import { SyncSettingsSheet } from '@/sync/sync-settings-sheet';
import { SyncStatusPanel } from '@/sync/sync-status';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { DownloadButton } from '@/desktop/download-button';
import { openLogPath } from '@/data/open-log';
import { dragRegion, useTrafficLights } from '@/desktop/title-bar';
import { cn } from '@/lib/utils';
import { dateTimeFormat, logLabel, formatSize } from '@/sync/format';
import { parseLogName } from '@/sync/log-names';
import { matchIcons } from '@/sync/match-icons';
import { type SyncFolder, usePlannedLogs, useSyncFolder, useSyncStatus } from '@/sync/sync';
import { updateSyncSettings, useSyncSettings } from '@/sync/sync-settings';

export const Route = createFileRoute('/logs')({
	component: Logs,
});

const dayMs = 24 * 60 * 60 * 1000;
/** How many of the newest logs to list */
const recentCount = 5;

function Logs() {
	if (!isTauri()) {
		return (
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderSyncIcon />
					</EmptyMedia>
					<EmptyTitle>Log sync needs the desktop app</EmptyTitle>
					<EmptyDescription>
						Browsers can’t copy logs from your robot, use the DogLog Studio desktop app instead.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<DownloadButton />
				</EmptyContent>
			</Empty>
		);
	}

	return <SyncOverview />;
}

/** Synced logs in the folder, newest first */
function syncedLogs(folder: SyncFolder | undefined) {
	return (folder?.logs ?? [])
		.flatMap((log) => {
			const parsed = parseLogName(log.name);
			return parsed ? [{ ...log, ...parsed }] : [];
		})
		.toSorted((a, b) => b.date.getTime() - a.date.getTime() || b.name.localeCompare(a.name));
}

function SyncOverview() {
	const status = useSyncStatus();
	const { enabled, days, demo } = useSyncSettings();
	const planned = usePlannedLogs();
	const folder = useSyncFolder();
	const navigate = useNavigate();
	const trafficLights = useTrafficLights();

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
			// Opens the folder with the newest log selected
			await revealItemInDir(await join(folder.path, newest.name));
		} else {
			await mkdir(folder.path, { recursive: true });
			await revealItemInDir(folder.path);
		}
	};

	const settingsButton = (
		<Button variant="ghost" size="sm">
			<SettingsIcon />
			Sync settings
		</Button>
	);

	if (!enabled && synced.length === 0) {
		return (
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderSyncIcon />
					</EmptyMedia>
					<EmptyTitle>Copy logs from your robot</EmptyTitle>
					<EmptyDescription>
						While Studio is open, new logs are copied over the robot’s network connection. Sync waits while the robot is
						enabled so it never slows it down.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent className="flex-row justify-center">
					<Button onClick={() => updateSyncSettings({ enabled: true, started: true })}>
						<PlayIcon />
						Start syncing
					</Button>
					<SyncSettingsSheet trigger={settingsButton} />
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="flex flex-col gap-8 p-6">
				{/* Reaches the top of the window, where the title bar would be, and goes below the title bar's buttons, even when the sidebar is expanded so it doesn't move when it's toggled */}
				{/* Sticks so the page doesn't scroll under those buttons, its bottom padding replaces some of the gap so there's room between it and the content scrolling under it */}
				<header
					{...dragRegion}
					className={cn(
						'sticky top-0 z-10 -mt-6 -mb-4 flex items-center justify-between gap-2 bg-background pt-6 pb-4',
						trafficLights && 'pt-11',
					)}
				>
					<h1 className="font-heading text-2xl font-semibold">Logs</h1>
					<div className="flex gap-2">
						<Button variant="ghost" size="sm" onClick={() => void openFolder()}>
							<FolderOpenIcon />
							Open folder
						</Button>
						<SyncSettingsSheet trigger={settingsButton} />
					</div>
				</header>

				{/* Centered in wide windows, under the full width header */}
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
					<section className="flex flex-col gap-8">
						<SyncStatusPanel status={status} enabled={enabled} boardLogs={boardLogs} days={days} />
						{boardLogs.length > 0 && <SyncBoard logs={boardLogs} onOpen={(name) => void open(name)} />}
					</section>

					{recent.length > 0 && (
						<section className="flex flex-col gap-2">
							<h2 className="text-sm font-medium">Recent logs</h2>
							<ul className="flex flex-col">
								{recent.map((log) => {
									const matchIcon = log.match === undefined ? undefined : matchIcons[log.match.type];
									return (
										<li key={log.name}>
											<button
												type="button"
												onClick={() => void open(log.name)}
												className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
											>
												{/* Logs from outside a match have no icon, like on the board */}
												<span className="size-4 shrink-0 text-muted-foreground">
													{matchIcon && <matchIcon.icon aria-label={matchIcon.label} className="size-4" />}
												</span>
												<span className="min-w-0 flex-1 truncate font-medium">{logLabel(log.name)}</span>
												{log.match !== undefined && (
													<span className="text-muted-foreground">{dateTimeFormat.format(log.date)}</span>
												)}
												<span className="w-14 text-right text-muted-foreground tabular-nums">
													{formatSize(log.size)}
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}
