// oxlint-disable max-lines -- The Files view's rows, dialogs, and drag and drop share its helpers
// The folders and files in the team's storage, see the log-storage spec's files
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { colorVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import { focusOutlineProps } from '@astryxdesign/core/utils/focusOutline.stylex';
import * as stylex from '@stylexjs/stylex';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import FileIcon from 'lucide-react/icons/file';
import FolderIcon from 'lucide-react/icons/folder';
import FolderPlusIcon from 'lucide-react/icons/folder-plus';
import UploadIcon from 'lucide-react/icons/upload';
import { type DragEvent, type SubmitEvent, useState } from 'react';
import { ConfirmCloudDialog } from '@/cloud/confirm-cloud-action';
import { AppActionMenu, AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { toastManager } from '@/components/toast';
import { chooseFiles } from '@/storage/choose-files';
import { type StorageFile, createStorage } from '@/storage/client';
import { joinPath } from '@/storage/connection';
import { refreshListing } from '@/storage/listing';
import { teamStorageStore } from '@/storage/team-storage';
import { addUploads } from '@/storage/uploads';
import { formatSize } from '@/sync/format';

const styles = stylex.create({
	crumbs: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacingVars['--spacing-1'] },
	list: { display: 'flex', flexDirection: 'column', margin: 0, padding: 0, listStyle: 'none' },
	row: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		minHeight: 36,
		paddingInline: spacingVars['--spacing-2'],
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: { default: 'transparent', ':hover': colorVars['--color-background-muted'] },
	},
	dropTarget: { boxShadow: `inset 0 0 0 2px ${colorVars['--color-accent']}` },
	name: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		flex: 1,
		minWidth: 0,
		padding: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		color: 'inherit',
		font: 'inherit',
		textAlign: 'start',
		cursor: 'pointer',
	},
	fileName: { cursor: 'default' },
});

interface Entry {
	name: string;
	/** Relative to the root folder */
	path: string;
	folder: boolean;
	/** Files in it, for folders */
	files: StorageFile[];
	size: number;
}

/** What's directly in `folder` */
function entriesIn(files: readonly StorageFile[], folder: string, created: readonly string[]): Entry[] {
	const prefix = folder === '' ? '' : `${folder}/`;
	const entries = new Map<string, Entry>();
	const add = (name: string, isFolder: boolean, file?: StorageFile) => {
		const path = prefix + name;
		const entry = entries.get(path) ?? { name, path, folder: isFolder, files: [], size: 0 };
		if (file) {
			entry.files.push(file);
			entry.size += file.size;
		}
		entries.set(path, entry);
	};
	for (const file of files) {
		if (file.path.startsWith(prefix)) {
			const [name, ...rest] = file.path.slice(prefix.length).split('/');
			add(name!, rest.length > 0, file);
		}
	}
	// Folders exist once something is in them, new ones are kept here until then
	for (const path of created) {
		if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) {
			add(path.slice(prefix.length), true);
		}
	}
	return [...entries.values()].toSorted((a, b) => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name));
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

/** Make a change, with a toast while it runs, since moving a folder in S3-compatible storage copies every file in it */
async function change(action: string, doing: string, run: () => Promise<void>): Promise<void> {
	const team = teamStorageStore.get();
	if (!team) {
		return;
	}
	const toast = toastManager.add({ type: 'loading', title: doing });
	try {
		await run();
		toastManager.close(toast);
	} catch (error) {
		toastManager.update(toast, { type: 'error', title: `Couldn’t ${action}`, description: String(error) });
	} finally {
		refreshListing();
	}
}

const storage = () => createStorage(teamStorageStore.get()!.connection);

/** Delete a file or folder, which throws so the confirmation shows why it failed */
async function removeEntry(path: string): Promise<void> {
	try {
		await storage().remove(path);
	} finally {
		refreshListing();
	}
}

/** Move a file or folder into `folder`, keeping its name */
const moveInto = (path: string, folder: string) => {
	const name = path.split('/').at(-1)!;
	if (parentOf(path) === folder || folder === path || folder.startsWith(`${path}/`)) {
		return;
	}
	void change(`move ${name}`, `Moving ${name}…`, () => storage().rename(path, joinPath(folder, name)));
};

function NameDialog({
	title,
	label,
	field = 'Name',
	initial,
	isPath = false,
	onSubmit,
	onClose,
}: {
	title: string;
	label: string;
	field?: string;
	initial: string;
	/** Takes a folder path from the root folder instead of a name, `''` for the root folder */
	isPath?: boolean;
	onSubmit: (name: string) => void;
	onClose: () => void;
}) {
	const [value, setValue] = useState(initial);
	const parts = value.split('/').map((part) => part.trim());
	const invalid = isPath
		? parts.some((part) => part === '.' || part === '..')
		: value.trim() === '' || value.includes('/') || value === '.' || value === '..';
	const submit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!invalid) {
			onSubmit(value.trim());
			onClose();
		}
	};
	return (
		<Dialog isOpen onOpenChange={(open) => !open && onClose()} purpose="form" width={400}>
			<form onSubmit={submit}>
				<Layout
					height="auto"
					header={<DialogHeader title={title} onOpenChange={(open) => !open && onClose()} />}
					content={
						<LayoutContent>
							<TextInput
								label={field}
								hasAutoFocus
								hasSpellCheck={false}
								value={value}
								width="100%"
								onChange={setValue}
							/>
						</LayoutContent>
					}
					footer={
						<LayoutFooter>
							<HStack gap={2} hAlign="end">
								<Button label="Cancel" variant="ghost" onClick={onClose} />
								<Button type="submit" label={label} variant="primary" isDisabled={invalid} />
							</HStack>
						</LayoutFooter>
					}
				/>
			</form>
		</Dialog>
	);
}

/** Lets entries be dropped on a folder to move them there */
function useMoveTarget(folder: string) {
	const [over, setOver] = useState(false);
	return {
		over,
		props: {
			onDragOver: (event: DragEvent) => {
				if (event.dataTransfer.types.includes('application/x-doglog-storage-path')) {
					event.preventDefault();
					event.dataTransfer.dropEffect = 'move';
					setOver(true);
				}
			},
			onDragLeave: () => setOver(false),
			onDrop: (event: DragEvent) => {
				setOver(false);
				const path = event.dataTransfer.getData('application/x-doglog-storage-path');
				if (path !== '') {
					event.preventDefault();
					moveInto(path, folder);
				}
			},
		},
	};
}

function Crumb({ label, path, onOpen }: { label: string; path: string; onOpen: (path: string) => void }) {
	const { over, props } = useMoveTarget(path);
	return (
		<span {...props} {...stylex.props(over && styles.dropTarget)}>
			<Button label={label} variant="ghost" size="sm" onClick={() => onOpen(path)} />
		</span>
	);
}

function EntryRow({ entry, menu, onOpen }: { entry: Entry; menu: MenuEntry[]; onOpen: (path: string) => void }) {
	const target = useMoveTarget(entry.path);
	const Icon = entry.folder ? FolderIcon : FileIcon;
	return (
		// Dragging is a shortcut, Move… in the row's menu moves it from the keyboard
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- See above
		<li
			draggable
			// Tells the list's context menu which entry was right-clicked
			data-path={entry.path}
			onDragStart={(event) => {
				event.dataTransfer.setData('application/x-doglog-storage-path', entry.path);
				event.dataTransfer.effectAllowed = 'move';
			}}
			{...(entry.folder ? target.props : {})}
			{...stylex.props(styles.row, target.over && styles.dropTarget)}
		>
			{entry.folder ? (
				<button
					type="button"
					onClick={() => onOpen(entry.path)}
					{...focusOutlineProps.focusVisible(undefined, styles.name)}
				>
					<Icon size={16} aria-hidden />
					<Text maxLines={1}>{entry.name}</Text>
				</button>
			) : (
				<span {...stylex.props(styles.name, styles.fileName)}>
					<Icon size={16} aria-hidden />
					<Text maxLines={1}>{entry.name}</Text>
				</span>
			)}
			<Text type="supporting" color="secondary" hasTabularNumbers>
				{entry.folder ? count(entry.files.length, 'file') : formatSize(entry.size)}
			</Text>
			<AppActionMenu label="Options" accessibleLabel={`Options for ${entry.name}`} items={() => menu} />
		</li>
	);
}

/** Browse the team's storage, upload to any folder, create folders, and rename, move, and delete anything */
export function FilesView({ files }: { files: readonly StorageFile[] }) {
	const [folder, setFolder] = useState('');
	const [created, setCreated] = useState<string[]>([]);
	const [dialog, setDialog] = useState<{ type: 'new-folder' } | { type: 'rename' | 'move' | 'delete'; entry: Entry }>();
	const entries = entriesIn(files, folder, created);
	const parts = folder === '' ? [] : folder.split('/');

	const upload = async () => {
		const chosen = await chooseFiles();
		addUploads(chosen.map((file) => Object.assign(file, { path: joinPath(folder, file.name) })));
	};
	const menuFor = (entry: Entry): MenuEntry[] => [
		{ label: 'Rename…', onSelect: () => setDialog({ type: 'rename', entry }) },
		{ label: 'Move…', onSelect: () => setDialog({ type: 'move', entry }) },
		{ label: 'Delete…', onSelect: () => setDialog({ type: 'delete', entry }) },
	];
	// A row's actions, or the folder's own when right-clicking around the rows
	const contextMenu = (target: Element): MenuEntry[] => {
		const path = target.closest<HTMLElement>('[data-path]')?.dataset['path'];
		const entry = entries.find((other) => other.path === path);
		return entry
			? menuFor(entry)
			: [
					{ label: 'New folder…', onSelect: () => setDialog({ type: 'new-folder' }) },
					{ label: 'Upload…', onSelect: () => void upload() },
				];
	};

	return (
		<>
			<AppContextMenu items={contextMenu} label="File actions">
				<VStack gap={3}>
					<HStack gap={2} vAlign="center" wrap="wrap">
						<nav aria-label="Folder" {...stylex.props(styles.crumbs)}>
							<Crumb label="Storage" path="" onOpen={setFolder} />
							{parts.map((part, index) => (
								<HStack key={parts.slice(0, index + 1).join('/')} gap={1} vAlign="center">
									<ChevronRightIcon size={14} aria-hidden />
									<Crumb label={part} path={parts.slice(0, index + 1).join('/')} onOpen={setFolder} />
								</HStack>
							))}
						</nav>
						<HStack gap={2} hAlign="end" wrap="wrap">
							<Button
								label="New folder"
								size="sm"
								icon={<FolderPlusIcon />}
								onClick={() => setDialog({ type: 'new-folder' })}
							/>
							<Button label="Upload" size="sm" icon={<UploadIcon />} onClick={() => void upload()} />
						</HStack>
					</HStack>

					{entries.length === 0 ? (
						<Text color="secondary">This folder is empty</Text>
					) : (
						<ul {...stylex.props(styles.list)}>
							{entries.map((entry) => (
								<EntryRow key={entry.path} entry={entry} menu={menuFor(entry)} onOpen={setFolder} />
							))}
						</ul>
					)}
				</VStack>
			</AppContextMenu>
			{dialog?.type === 'new-folder' && (
				<NameDialog
					title="New folder"
					label="Create"
					initial=""
					onClose={() => setDialog(undefined)}
					onSubmit={(name) => {
						const path = joinPath(folder, name);
						setCreated((current) => [...current, path]);
						setFolder(path);
					}}
				/>
			)}
			{dialog?.type === 'rename' && (
				<NameDialog
					title={`Rename ${dialog.entry.name}`}
					label="Rename"
					initial={dialog.entry.name}
					onClose={() => setDialog(undefined)}
					onSubmit={(name) => {
						const { entry } = dialog;
						if (name !== entry.name) {
							void change(`rename ${entry.name}`, `Renaming ${entry.name}…`, () =>
								storage().rename(entry.path, joinPath(parentOf(entry.path), name)),
							);
						}
					}}
				/>
			)}
			{dialog?.type === 'move' && (
				<NameDialog
					title={`Move ${dialog.entry.name}`}
					label="Move"
					field="Folder"
					initial={parentOf(dialog.entry.path)}
					isPath
					onClose={() => setDialog(undefined)}
					onSubmit={(path) => moveInto(dialog.entry.path, joinPath(path))}
				/>
			)}
			<ConfirmCloudDialog
				open={dialog?.type === 'delete'}
				onOpenChange={() => setDialog(undefined)}
				label="Delete"
				destructive
				title={dialog?.type === 'delete' ? `Delete ${dialog.entry.name}?` : ''}
				description={
					dialog?.type === 'delete'
						? `${dialog.entry.folder ? `Deletes the folder and its ${count(dialog.entry.files.length, 'file')} from the team’s storage for everyone.` : 'Deletes the file from the team’s storage for everyone.'} This can’t be undone unless your storage keeps old versions.`
						: ''
				}
				failureMessage="Couldn’t delete it. Try again."
				onConfirm={async () => {
					if (dialog?.type === 'delete') {
						const { path } = dialog.entry;
						setCreated((current) => current.filter((other) => other !== path && !other.startsWith(`${path}/`)));
						await removeEntry(path);
					}
				}}
			/>
		</>
	);
}
