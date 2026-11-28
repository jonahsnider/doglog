import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import AppWindowIcon from 'lucide-react/icons/app-window';
import CheckIcon from 'lucide-react/icons/check';
import CloudUploadIcon from 'lucide-react/icons/cloud-upload';
import HourglassIcon from 'lucide-react/icons/hourglass';
import LoaderCircleIcon from 'lucide-react/icons/loader-circle';
import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import RefreshCwIcon from 'lucide-react/icons/refresh-cw';
import SettingsIcon from 'lucide-react/icons/settings';
import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import type { LucideIcon } from 'lucide-react/types';
import type { ReactNode } from 'react';
import { TextMorph } from '@/components/text-morph';
import { type BoardLog, SyncBoard } from '@/sync/sync-board';
import { formatSize, logLabel } from '@/sync/format';
import { SyncRow } from '@/sync/sync-row';
import { type SyncStatus, syncNow } from '@/sync/sync';
import { updateSyncSettings } from '@/sync/sync-settings';

const minutesFormat = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'minute', unitDisplay: 'long' });

interface StatusView {
	icon: LucideIcon;
	spin?: boolean;
	title: string;
	detail?: ReactNode;
	action?: ReactNode;
}

function timeLeft(seconds: number): string {
	return seconds < 60 ? 'less than a minute left' : `about ${minutesFormat.format(Math.round(seconds / 60))} left`;
}

function viewFor(status: SyncStatus): StatusView {
	switch (status.type) {
		case 'paused':
			return { icon: PauseIcon, title: 'Downloads are paused' };
		case 'no-robot':
			return {
				icon: SettingsIcon,
				title: 'Set your team number to download logs',
				action: <Button label="Open Settings" size="sm" href="/settings" />,
			};
		case 'other-app':
			return { icon: AppWindowIcon, title: 'Downloading in another Studio window' };
		case 'waiting':
			return {
				icon: LoaderCircleIcon,
				spin: true,
				title: 'Looking for the robot',
				detail: status.error ?? `Trying ${status.host}`,
			};
		case 'robot-enabled':
			return { icon: HourglassIcon, title: 'Waiting for the robot to be disabled' };
		case 'syncing':
			return {
				icon: LoaderCircleIcon,
				spin: true,
				title: `Downloading ${logLabel(status.file)}`,
				detail: (
					<>
						<TextMorph as="span">{`Log ${status.fileNumber} of ${status.fileCount}`}</TextMorph>,{' '}
						<TextMorph as="span">{formatSize(status.copied)}</TextMorph> of{' '}
						<TextMorph as="span">{formatSize(status.total)}</TextMorph>
						{status.secondsLeft !== undefined && `, ${timeLeft(status.secondsLeft)}`}
					</>
				),
			};
		case 'up-to-date':
			return {
				icon: CheckIcon,
				title: 'Up to date',
				action: (
					<IconButton
						label="Check for new logs"
						tooltip="Check for new logs"
						variant="ghost"
						icon={<RefreshCwIcon />}
						onClick={syncNow}
					/>
				),
			};
		case 'waiting-for-uploads':
			return { icon: CloudUploadIcon, title: 'Waiting for uploads to free up space' };
		default:
			return {
				icon: TriangleAlertIcon,
				title: 'Couldn’t download logs',
				detail: status.message,
				action: <Button label="Try again" size="sm" icon={<RefreshCwIcon />} onClick={syncNow} />,
			};
	}
}

/** The robot's row on the Logs page: what sync is doing, its pause, and a square for each run on the robot */
export function RobotRow({
	status,
	enabled,
	squares,
	onOpen,
}: {
	status: SyncStatus;
	enabled: boolean;
	squares: BoardLog[];
	onOpen: (name: string) => void;
}) {
	const view = viewFor(status);
	return (
		<SyncRow
			icon={view.icon}
			isSpinning={view.spin === true}
			title={view.title}
			detail={view.detail}
			progress={status.type === 'syncing' ? { value: status.copied, max: status.total } : undefined}
			actions={
				<>
					{view.action}
					<IconButton
						label={enabled ? 'Pause downloads' : 'Resume downloads'}
						tooltip={enabled ? 'Pause downloads' : 'Resume downloads'}
						variant="ghost"
						icon={enabled ? <PauseIcon /> : <PlayIcon />}
						onClick={() => updateSyncSettings({ enabled: !enabled })}
					/>
				</>
			}
		>
			{squares.length > 0 ? <SyncBoard logs={squares} onOpen={onOpen} /> : undefined}
		</SyncRow>
	);
}
