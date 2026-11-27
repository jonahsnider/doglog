// URLs posters and videos in the team's storage can be shown from
import { useQuery } from '@tanstack/react-query';
import { Channel, convertFileSrc, invoke } from '@tauri-apps/api/core';
import { appCacheDir, join } from '@tauri-apps/api/path';
import type { SftpStorage } from '@/storage/client';
import { uint8ArrayToBase64 } from 'uint8array-extras';
import { S3Storage, createStorage, sftpArgs } from '@/storage/client';
import { canReach } from '@/storage/listing';
import { useTeamStorage } from '@/storage/team-storage';

/** Presigned URLs last an hour, refresh them well before */
const presignedFor = 45 * 60 * 1000;

async function mediaUrl(storage: S3Storage | SftpStorage, path: string, kind: 'image' | 'video'): Promise<string> {
	if (storage instanceof S3Storage) {
		return storage.presign(path);
	}
	if (kind === 'image') {
		// A data URL, since nothing knows when an object URL could be revoked
		return `data:image/jpeg;base64,${uint8ArrayToBase64(new Uint8Array(await storage.read(path)))}`;
	}
	// The webview can't stream over SFTP, so videos are played from a copy in the cache folder
	const localPath = await join(await appCacheDir(), 'storage', ...path.split('/'));
	await invoke('sftp_download', {
		connection: sftpArgs(storage.connection),
		path,
		localPath,
		onProgress: new Channel<number>(() => {}),
	});
	await invoke('allow_video', { path: localPath });
	return convertFileSrc(localPath);
}

/** A URL for a poster or video in the team's storage, `undefined` while it's loading or without one */
export function useStorageUrl(path: string | undefined, kind: 'image' | 'video'): string | undefined {
	const team = useTeamStorage();
	const { data } = useQuery({
		queryKey: ['storage-media', team?.connection, path, kind],
		queryFn: () => mediaUrl(createStorage(team!.connection), path!, kind),
		enabled: team !== null && path !== undefined && canReach(team.connection),
		staleTime: presignedFor,
		refetchInterval: team?.connection.kind === 's3' ? presignedFor : false,
		networkMode: 'always',
		retry: false,
	});
	return data;
}
