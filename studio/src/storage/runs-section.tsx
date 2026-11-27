// The team's runs from the sync folder and storage on the Logs page, see the log-storage spec's runs timeline and files
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Layout';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { useHotkey } from '@tanstack/react-hotkeys';
import { Text } from '@astryxdesign/core/Text';
import { colorVars, radiusVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import UploadIcon from 'lucide-react/icons/upload';
import { type DragEvent, useState } from 'react';
import { shortcuts } from '@/commands/commands';
import { TooltipLabel } from '@/components/tooltip-label';
import { useFileDropTarget } from '@/desktop/file-drop';
import { type AddFiles, AddFilesDialog } from '@/storage/add-files-dialog';
import { chooseFiles, filesFromPaths } from '@/storage/choose-files';
import { FilesView } from '@/storage/files-view';
import { isAddable } from '@/storage/format';
import { useCanReachStorage, useListing } from '@/storage/listing';
import { mergeRuns, storageRuns } from '@/storage/runs';
import { uploadLogs, useUploadStatus } from '@/storage/uploads';
import type { Run } from '@/sync/runs';
import { RunsTimeline } from '@/sync/runs-timeline';

const styles = stylex.create({
	dropZone: { borderRadius: radiusVars['--radius-container'], outlineOffset: 8 },
	dragging: { outline: `2px dashed ${colorVars['--color-accent']}` },
});

const listedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Chooses logs and videos to upload to the team's runs, for the Logs page header */
export function UploadButton({ onAdd }: { onAdd: (add: AddFiles) => void }) {
	const chooseAndAdd = async () => {
		const videos = uploadLogs(await chooseFiles());
		if (videos.length > 0) {
			onAdd({ type: 'files', files: videos });
		}
	};
	return <Button label="Upload" variant="ghost" size="sm" icon={<UploadIcon />} onClick={() => void chooseAndAdd()} />;
}

export type RunsView = 'runs' | 'files';

/**
 * The runs timeline, or the Files view while the team has storage. Logs and videos dropped on it upload to runs, through
 * `adding`, which the page's Upload button also sets.
 */
export function RunsSection({
	localRuns,
	view,
	onView,
	adding,
	onAdd,
	onOpen,
}: {
	localRuns: readonly Run[];
	view: RunsView;
	onView: (view: RunsView) => void;
	adding: AddFiles | undefined;
	onAdd: (add: AddFiles | undefined) => void;
	onOpen: (run: Run) => void;
}) {
	const reachable = useCanReachStorage();
	useHotkey(shortcuts.showRuns, () => onView('runs'), { enabled: reachable });
	useHotkey(shortcuts.showFiles, () => onView('files'), { enabled: reachable });
	const listing = useListing();
	const upload = useUploadStatus();
	const [webDragging, setWebDragging] = useState(false);
	const runs = listing.data ? mergeRuns(localRuns, storageRuns(listing.data)) : localRuns;
	const { ref: dropRef, over: dropOver } = useFileDropTarget(
		(name) => reachable && view === 'runs' && isAddable(name),
		(paths) => {
			const add = async () => {
				const videos = uploadLogs(await filesFromPaths(paths));
				if (videos.length > 0) {
					onAdd({ type: 'files', files: videos });
				}
			};
			void add();
		},
	);
	const open = (run: Run) => {
		// A video that isn't linked to a log yet is linked when it's opened
		const [video] = run.videos;
		if (run.logs.length === 0 && video) {
			onAdd({ type: 'link', video });
		} else {
			onOpen(run);
		}
	};
	const dropProps = reachable &&
		view === 'runs' && {
			onDragOver: (event: DragEvent<HTMLDivElement>) => {
				if (event.dataTransfer.types.includes('Files')) {
					event.preventDefault();
					event.dataTransfer.dropEffect = 'copy';
					setWebDragging(true);
				}
			},
			onDragLeave: (event: DragEvent<HTMLDivElement>) => {
				if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
					setWebDragging(false);
				}
			},
			onDrop: (event: DragEvent<HTMLDivElement>) => {
				setWebDragging(false);
				const files = [...event.dataTransfer.files].filter((file) => isAddable(file.name));
				if (files.length > 0) {
					// Taken here instead of opening the logs in the window
					event.preventDefault();
					const videos = uploadLogs(
						files.map((file) => ({ name: file.name, size: file.size, modified: file.lastModified, file })),
					);
					if (videos.length > 0) {
						onAdd({ type: 'files', files: videos });
					}
				}
			},
		};

	const viewControl = (
		<SegmentedControl label="View" value={view} onChange={(value) => onView(value === 'files' ? 'files' : 'runs')}>
			<Tooltip content={<TooltipLabel label="Runs" shortcut={shortcuts.showRuns} />}>
				<SegmentedControlItem value="runs" label="Runs" />
			</Tooltip>
			<Tooltip content={<TooltipLabel label="Files" shortcut={shortcuts.showFiles} />}>
				<SegmentedControlItem value="files" label="Files" />
			</Tooltip>
		</SegmentedControl>
	);

	return (
		<VStack gap={4}>
			{adding && <AddFilesDialog add={adding} runs={runs} onClose={() => onAdd(undefined)} />}
			{listing.data?.error !== undefined && (
				<Text type="supporting" color="secondary">
					Couldn’t reach the team’s storage, showing the runs listed {listedFormat.format(listing.data.at)}
				</Text>
			)}
			{listing.error && (
				<Text type="supporting" color="secondary">
					Couldn’t list the team’s storage: {listing.error.message}
				</Text>
			)}
			{view === 'files' && reachable ? (
				<VStack gap={4}>
					{viewControl}
					<FilesView files={listing.data?.files ?? []} />
				</VStack>
			) : (
				<div
					ref={dropRef}
					{...dropProps}
					{...stylex.props(styles.dropZone, (webDragging || dropOver) && styles.dragging)}
				>
					<RunsTimeline
						runs={runs}
						hasStorage={reachable}
						upload={upload}
						tools={reachable && viewControl}
						onOpen={open}
					/>
				</div>
			)}
		</VStack>
	);
}
