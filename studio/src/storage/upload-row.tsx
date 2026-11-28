import { IconButton } from '@astryxdesign/core/IconButton';
import CloudCheckIcon from 'lucide-react/icons/cloud-check';
import CloudOffIcon from 'lucide-react/icons/cloud-off';
import CloudUploadIcon from 'lucide-react/icons/cloud-upload';
import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import type { LucideIcon } from 'lucide-react/types';
import type { ReactNode } from 'react';
import { TextMorph } from '@/components/text-morph';
import { useTeamStorage } from '@/storage/team-storage';
import { type UploadStatus, useUploadStatus } from '@/storage/uploads';
import { formatSize, logLabel } from '@/sync/format';
import { SyncRow } from '@/sync/sync-row';
import { updateSyncSettings, useSyncSettings } from '@/sync/sync-settings';

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

function viewFor(status: UploadStatus): { icon: LucideIcon; title: string; detail?: ReactNode } {
	switch (status.type) {
		case 'uploading':
			return {
				icon: CloudUploadIcon,
				title: `Uploading ${logLabel(status.name)}`,
				detail: (
					<>
						<TextMorph as="span">{formatSize(status.uploaded)}</TextMorph> of{' '}
						<TextMorph as="span">{formatSize(status.size)}</TextMorph>
						{status.waiting > 0 && (
							<>
								, <TextMorph as="span">{String(status.waiting)}</TextMorph> more waiting
							</>
						)}
					</>
				),
			};
		case 'paused':
			return {
				icon: PauseIcon,
				title: 'Uploads are paused',
				detail: status.waiting > 0 ? `${count(status.waiting, 'file')} waiting` : undefined,
			};
		case 'offline':
			return {
				icon: CloudOffIcon,
				title: `Can’t reach the team’s storage`,
				detail: status.waiting > 0 ? `${count(status.waiting, 'file')} waiting. ${status.error}` : status.error,
			};
		case 'error':
			return { icon: TriangleAlertIcon, title: 'Couldn’t upload', detail: status.message };
		case 'up-to-date':
			return { icon: CloudCheckIcon, title: 'Up to date' };
		default:
			return { icon: CloudUploadIcon, title: 'The team’s storage needs the desktop app' };
	}
}

/** What uploading to the team's storage is doing, with its own pause, see the log-sync spec's Logs page header */
export function UploadRow() {
	const storage = useTeamStorage();
	const status = useUploadStatus();
	const { uploadsEnabled } = useSyncSettings();
	if (!storage || status.type === 'no-storage') {
		return null;
	}
	const { icon: Icon, title, detail } = viewFor(status);

	return (
		<SyncRow
			icon={Icon}
			title={title}
			detail={detail}
			progress={status.type === 'uploading' ? { value: status.uploaded, max: status.size } : undefined}
			actions={
				status.type === 'desktop-only' ? undefined : (
					<IconButton
						label={uploadsEnabled ? 'Pause uploads' : 'Resume uploads'}
						tooltip={uploadsEnabled ? 'Pause uploads' : 'Resume uploads'}
						variant="ghost"
						icon={uploadsEnabled ? <PauseIcon /> : <PlayIcon />}
						onClick={() => updateSyncSettings({ uploadsEnabled: !uploadsEnabled })}
					/>
				)
			}
		/>
	);
}
