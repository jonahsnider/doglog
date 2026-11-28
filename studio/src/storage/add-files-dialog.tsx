// Adds logs and videos to the team's runs, see the log-storage spec's upload logs and videos
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, Layout, LayoutContent, LayoutFooter, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useEffect, useState } from 'react';
import { toastManager } from '@/components/toast';
import type { ChosenFile } from '@/storage/choose-files';
import { createStorage } from '@/storage/client';
import { type StorageConnection, joinPath } from '@/storage/connection';
import { angleFromName, unsortedFolder } from '@/storage/format';
import { refreshListing } from '@/storage/listing';
import { teamStorageStore } from '@/storage/team-storage';
import { addUploads } from '@/storage/uploads';
import { inspectVideo, moveVideo } from '@/storage/video-files';
import type { Run, RunVideo } from '@/sync/runs';

/** What to add: videos a member chose or dropped, or a video in storage that isn't linked to a run yet */
export type AddFiles = { type: 'files'; files: ChosenFile[] } | { type: 'link'; video: RunVideo };

const unsorted = 'unsorted';
/** How long a run is taken to last when its `doglog.json` file doesn't say, about a match */
const defaultRunSeconds = 180;
const runFormat = new Intl.DateTimeFormat(undefined, {
	weekday: 'short',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
});

/** The run whose log was enabled for the most of when the video was recorded, `undefined` when none was */
function suggestRun(runs: readonly Run[], start: number, end: number): Run | undefined {
	let best: { run: Run; overlap: number } | undefined;
	for (const run of runs) {
		const runEnd = run.start + (run.duration ?? defaultRunSeconds) * 1000;
		const overlap = Math.min(end, runEnd) - Math.max(start, run.start);
		if (overlap > 0 && (!best || overlap > best.overlap)) {
			best = { run, overlap };
		}
	}
	return best?.run;
}

interface VideoChoice {
	/** Run folder, or `unsorted` */
	folder: string;
	angle: string;
	/** When the video started recording, from when it stopped and its length */
	start: number;
}

/** The video's sync with a run, where a moment in the video is the moment in the log plus the offset */
const offsetFor = (run: Run | undefined, videoStart: number) => (run ? (run.start - videoStart) / 1000 : 0);

/** Move an unlinked video into a run, returns whether it worked */
async function linkVideo(
	connection: StorageConnection,
	video: RunVideo,
	folder: string,
	info: { angle: string; offset: number },
): Promise<boolean> {
	try {
		await moveVideo(createStorage(connection), video, folder, info);
		return true;
	} catch (error) {
		toastManager.add({ type: 'error', title: 'Couldn’t link the video', description: String(error) });
		return false;
	} finally {
		refreshListing();
	}
}

export function AddFilesDialog({ add, runs, onClose }: { add: AddFiles; runs: readonly Run[]; onClose: () => void }) {
	const withLogs = runs.filter((run) => run.logs.length > 0);
	const videos = add.type === 'files' ? add.files : [];
	const [choices, setChoices] = useState<Record<string, VideoChoice>>({});
	const [linkChoice, setLinkChoice] = useState<VideoChoice>(() =>
		add.type === 'link'
			? {
					folder: withLogs[0]?.folder ?? unsorted,
					// A video without a sidecar is named by its file, so suggest an angle from that instead
					angle: add.video.sidecar === undefined ? angleFromName(add.video.angle) : add.video.angle,
					start: 0,
				}
			: { folder: unsorted, angle: '', start: 0 },
	);
	const [saving, setSaving] = useState(false);

	// Suggest a run for each video once its length is known
	const videoKey = videos.map((file) => `${file.name}:${file.modified}`).join('\n');
	useEffect(() => {
		let active = true;
		const suggest = async () => {
			const found = await Promise.all(
				videos.map(async (file) => {
					const { duration } = await inspectVideo('file' in file ? { file: file.file } : { localPath: file.localPath });
					const start = file.modified - (duration ?? 0) * 1000;
					const run = duration === undefined ? undefined : suggestRun(withLogs, start, file.modified);
					return [file.name, { folder: run?.folder ?? unsorted, angle: angleFromName(file.name), start }] as const;
				}),
			);
			if (active) {
				setChoices(Object.fromEntries(found));
			}
		};
		void suggest();
		return () => {
			active = false;
		};
		// The runs change as the storage is listed again, the suggestion is kept once made
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- See above
	}, [videoKey]);

	const options = [
		...withLogs.map((run) => ({
			value: run.folder,
			label: run.start === 0 ? (run.match ?? run.folder) : `${run.match ?? 'Run'} · ${runFormat.format(run.start)}`,
		})),
		...(add.type === 'files' ? [{ value: unsorted, label: 'Unsorted, link it later' }] : []),
	];
	const runAt = (folder: string) => withLogs.find((run) => run.folder === folder);
	const ready = videos.every((file) => choices[file.name] !== undefined);

	const confirm = async () => {
		if (add.type === 'files') {
			addUploads(
				videos.map((file) => {
					const choice = choices[file.name]!;
					const run = runAt(choice.folder);
					const folder = run?.folder ?? unsortedFolder(new Date(choice.start));
					return {
						...file,
						path: joinPath(folder, file.name),
						video: { angle: choice.angle.trim() || angleFromName(file.name), offset: offsetFor(run, choice.start) },
					};
				}),
			);
			onClose();
			return;
		}
		const team = teamStorageStore.get();
		const run = runAt(linkChoice.folder);
		if (!team || !run) {
			return;
		}
		setSaving(true);
		const linked = await linkVideo(team.connection, add.video, run.folder, {
			angle: linkChoice.angle.trim() || add.video.angle,
			offset: add.video.offset,
		});
		// react-doctor-disable-next-line react-doctor/no-loading-flag-reset-outside-finally -- `linkVideo()` doesn't throw
		setSaving(false);
		if (linked) {
			onClose();
		}
	};

	const videoRow = (name: string, choice: VideoChoice | undefined, onChange: (choice: VideoChoice) => void) => (
		<VStack key={name} gap={2}>
			<Text type="label" maxLines={1}>
				{name}
			</Text>
			{choice ? (
				<HStack gap={2} wrap="wrap">
					<StackItem size="fill">
						<Selector
							label="Run"
							options={options}
							value={choice.folder}
							width="100%"
							onChange={(folder) => onChange({ ...choice, folder })}
						/>
					</StackItem>
					<TextInput
						label="Angle"
						placeholder="Stands"
						value={choice.angle}
						width={160}
						onChange={(angle) => onChange({ ...choice, angle })}
					/>
				</HStack>
			) : (
				<Text type="supporting" color="secondary">
					Finding the run it’s from…
				</Text>
			)}
		</VStack>
	);

	return (
		<Dialog isOpen onOpenChange={(open) => !open && onClose()} width={520}>
			<Layout
				height="auto"
				header={
					<DialogHeader
						title={add.type === 'link' ? 'Link video to a run' : 'Upload videos'}
						onOpenChange={(open) => !open && onClose()}
					/>
				}
				content={
					<LayoutContent>
						<VStack gap={5}>
							{add.type === 'link' &&
								videoRow(add.video.file?.split('/').at(-1) ?? add.video.angle, linkChoice, setLinkChoice)}
							{videos.map((file) =>
								videoRow(file.name, choices[file.name], (choice) =>
									setChoices((current) => ({ ...current, [file.name]: choice })),
								),
							)}
						</VStack>
					</LayoutContent>
				}
				footer={
					<LayoutFooter>
						<HStack gap={2} hAlign="end">
							<Button label="Cancel" variant="ghost" onClick={onClose} />
							<Button
								label={add.type === 'link' ? 'Link' : 'Upload'}
								variant="primary"
								isLoading={saving}
								isDisabled={!ready || options.length === 0}
								onClick={() => void confirm()}
							/>
						</HStack>
					</LayoutFooter>
				}
			/>
		</Dialog>
	);
}
