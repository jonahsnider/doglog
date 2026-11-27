// Robot projects the user added, read where they are: the desktop app remembers folder paths, and the web app keeps
// directory handles. Both are kept in IndexedDB, which can store handles.
import { useSelector } from '@tanstack/react-store';
import { useEffect } from 'react';
import { createAtom } from '@tanstack/store';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { get, set } from 'idb-keyval';
import * as z from 'zod';
import { toastManager } from '@/components/toast';
import { createPersistedAtom } from '@/lib/persisted-store';
import type { ReadProjectFile } from '@/three/robot-config';
import { widgetOptions } from '@/widgets/widget-info';

/** A robot in a project the user added, a project with several robots has an entry for each */
export type RobotProject = {
	/** The robot's name from its config, robots are picked by name so shared dashboards work on other devices */
	readonly name: string;
	/** The project folder on desktop */
	readonly path?: string;
	/** The project folder on the web */
	readonly handle?: FileSystemDirectoryHandle;
};

/** The robots of one project folder */
export type ProjectFolder = readonly [RobotProject, ...RobotProject[]];

const storageKey = 'doglog-studio:robot-projects';
const projectsStore = createAtom<readonly RobotProject[] | undefined>(undefined);
/** The projects grouped by folder, since a folder's robots are saved as separate projects */
const foldersStore = createAtom<readonly ProjectFolder[] | undefined>(undefined);
/** The robot picked last on this device, new robot widgets start with it. Empty before one is picked. */
const lastRobotStore = createPersistedAtom('last-robot', z.string().catch(''), '');

/** Remember a robot the user picked, so new robot widgets start with it */
export function rememberRobot(name: string): void {
	lastRobotStore.set(name);
}

/**
 * The robot new robot widgets and field widgets start with, saved in them so shared dashboards show it on every device:
 * the robot picked last on this device. `undefined` for the swerve drivebase, before one is picked, or after its project
 * is removed.
 */
export function getLastRobot(): string | undefined {
	const last = lastRobotStore.get();
	return last === '' || last === widgetOptions.robot.robot.default ? undefined : last;
}

function isSameFolder(a: RobotProject, b: RobotProject): Promise<boolean> {
	if (a.path !== b.path) {
		return Promise.resolve(false);
	}
	return a.handle === undefined || b.handle === undefined
		? Promise.resolve(a.handle === b.handle)
		: a.handle.isSameEntry(b.handle);
}

function isSameProject(a: RobotProject, b: RobotProject): Promise<boolean> {
	return a.name === b.name ? isSameFolder(a, b) : Promise.resolve(false);
}

/** The saved projects without the robots of `project`'s folder, or with the same names as `names` */
async function savedProjectsWithout(project: RobotProject, names: readonly string[] = []): Promise<RobotProject[]> {
	const saved = (await get<RobotProject[]>(storageKey)) ?? [];
	const same = await Promise.all(saved.map((other) => isSameFolder(other, project)));
	const replaced = new Set(names);
	return saved.filter((other, index) => same[index] === false && !replaced.has(other.name));
}

async function loadProjects(): Promise<void> {
	const saved = (await get<RobotProject[]>(storageKey)) ?? [];
	const current = projectsStore.get() ?? [];
	// Unchanged projects keep their objects, so their loaded models are kept, see `useLoadedRobot()`
	const projects = await Promise.all(
		saved.map(async (project) => {
			const same = await Promise.all(current.map((other) => isSameProject(project, other)));
			return current[same.indexOf(true)] ?? project;
		}),
	);
	const sameAsEarlier = await Promise.all(
		projects.map((project, index) =>
			Promise.all(projects.slice(0, index).map((other) => isSameFolder(other, project))),
		),
	);
	const folders: [RobotProject, ...RobotProject[]][] = [];
	for (const [index, project] of projects.entries()) {
		const earlier = projects[sameAsEarlier[index]!.indexOf(true)];
		const folder = earlier && folders.find((other) => other.includes(earlier));
		if (folder) {
			folder.push(project);
		} else {
			folders.push([project]);
		}
	}
	foldersStore.set(folders);
	projectsStore.set(projects);
}

let loading = false;

/** Load the projects the first time they're used, and again when other windows may have added or removed some */
function startLoading(): void {
	if (!loading) {
		loading = true;
		void loadProjects();
		window.addEventListener('focus', () => void loadProjects());
	}
}

async function saveProjects(projects: readonly RobotProject[]): Promise<void> {
	await set(storageKey, projects);
	await loadProjects();
}

/** Projects already loaded by the 3D widget, read when its legend menu opens. */
export function getRobotProjects(): readonly RobotProject[] {
	return projectsStore.get() ?? [];
}

/** The projects the user added, `undefined` while they load */
export function useRobotProjects(): readonly RobotProject[] | undefined {
	useEffect(startLoading, []);
	return useSelector(projectsStore);
}

/** The folders of the projects the user added, each with its robots' projects, `undefined` while they load */
export function useRobotProjectFolders(): readonly ProjectFolder[] | undefined {
	useEffect(startLoading, []);
	return useSelector(foldersStore);
}

/** A project by its robot's name, `null` if there's none, or `undefined` while projects load */
export function useRobotProject(name: string): RobotProject | null | undefined {
	useEffect(startLoading, []);
	const projects = useSelector(projectsStore);
	return projects && (projects.find((project) => project.name === name) ?? null);
}

/** Why projects can't be added, `undefined` when they can. The web app needs a Chromium browser to keep access to folders. */
export const cantAddRobotProjects =
	STUDIO_DESKTOP || 'showDirectoryPicker' in globalThis ? undefined : 'Needs Chrome, Edge, or the desktop app';

/** The web app lost access to a project's folder, ex. after reloading, and needs the user to allow it again */
export class ProjectAccessError extends Error {}

export function projectFileReader(project: RobotProject): ReadProjectFile {
	const { path, handle } = project;
	if (STUDIO_DESKTOP && path !== undefined) {
		return async (file) => {
			try {
				return await invoke<ArrayBuffer>('read_file', { path: `${path}/${file}` });
			} catch {
				return undefined;
			}
		};
	}
	if (handle === undefined) {
		return () => Promise.resolve(undefined);
	}
	return async (file) => {
		if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') {
			throw new ProjectAccessError(`DogLog Studio needs access to ${project.name}'s folder again`);
		}
		const segments = file.split(/[/\\]/u);
		const name = segments.pop()!;
		try {
			let folder = handle;
			for (const segment of segments) {
				// oxlint-disable-next-line no-await-in-loop -- Each folder is found inside the one before it
				folder = await folder.getDirectoryHandle(segment);
			}
			return await (await (await folder.getFileHandle(name)).getFile()).arrayBuffer();
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				return undefined;
			}
			throw error;
		}
	};
}

/** Ask to read a project's folder again, call it from a click */
export async function allowProjectAccess(project: RobotProject): Promise<boolean> {
	return (await project.handle?.requestPermission({ mode: 'read' })) === 'granted';
}

/** Whether a file is a robot project's config, see `readRobotConfigs()` */
export function isRobotConfig(path: string): boolean {
	const name = path.split(/[/\\]/u).at(-1);
	return name === 'doglog.jsonc' || name === 'doglog.json';
}

/**
 * Whether a dropped folder with these files is a robot project: it has a `doglog.jsonc` or `doglog.json`, or an
 * AdvantageScope robot's `config.json` and `model.glb`, since a `config.json` alone could be anything
 */
export function isRobotProjectFolder(files: readonly string[]): boolean {
	const names = new Set(files.map((path) => path.split(/[/\\]/u).at(-1)));
	return files.some((path) => isRobotConfig(path)) || (names.has('config.json') && names.has('model.glb'));
}

/** Say to drop a project's folder instead of its config file, the web app can't read the folder of a dropped file */
export function showDroppedConfigError(name: string): void {
	toastManager.add({
		type: 'error',
		title: "Drop the robot project's folder instead",
		description: `Studio needs the whole folder to read the robot's models, not just ${name}.`,
	});
}

function showAddError(error: unknown): void {
	toastManager.add({
		type: 'error',
		title: "Couldn't add the project",
		description: error instanceof Error ? error.message : String(error),
	});
}

/**
 * Add a project folder's robots, replacing robots with the same names and the folder's robots from when it was added
 * before. The first robot is remembered for new robot widgets. Returns the robots' names.
 */
async function addProjectFolder(project: Omit<RobotProject, 'name'>): Promise<string[]> {
	const { readRobotConfigs } = await import('@/three/robot-config');
	const names = (await readRobotConfigs(projectFileReader({ name: '', ...project }))).map(({ name }) => name);
	const others = await savedProjectsWithout({ name: '', ...project }, names);
	// Removed first so a project added again is a new object, and its models load again with any changes
	await saveProjects(others);
	await saveProjects([...others, ...names.map((name) => ({ name, ...project }))]);
	rememberRobot(names[0]!);
	return names;
}

/**
 * Pick a project's folder and add its robots, see `addProjectFolder()`.
 * Returns the first robot's name, or `undefined` when it's canceled or fails, showing a toast saying why.
 */
export async function addRobotProject(): Promise<string | undefined> {
	try {
		let project: Omit<RobotProject, 'name'>;
		if (STUDIO_DESKTOP) {
			const path = await openDialog({ directory: true, title: 'Add a robot project' });
			if (path === null) {
				return undefined;
			}
			project = { path };
		} else {
			project = { handle: await window.showDirectoryPicker!({ mode: 'read' }) };
		}
		return (await addProjectFolder(project))[0];
	} catch (error) {
		if (!(error instanceof DOMException && error.name === 'AbortError')) {
			showAddError(error);
		}
		return undefined;
	}
}

/**
 * Add a project folder dropped on the window, by its path on desktop or its handle on the web, with a toast either way.
 * `undefined` for a folder the browser can't keep access to.
 */
export async function addDroppedRobotProject(project: Omit<RobotProject, 'name'> | undefined): Promise<void> {
	if (project === undefined) {
		showAddError(cantAddRobotProjects ?? "The browser didn't give access to the folder");
		return;
	}
	try {
		const names = await addProjectFolder(project);
		toastManager.add({ type: 'success', title: 'Added a robot project', description: names.join(', ') });
	} catch (error) {
		showAddError(error);
	}
}

/** Remove the project of the robot named `name`, with all its robots */
export async function removeRobotProject(name: string): Promise<void> {
	const project = getRobotProjects().find((other) => other.name === name);
	if (project !== undefined) {
		const kept = await savedProjectsWithout(project);
		await saveProjects(kept);
		if (!kept.some((other) => other.name === lastRobotStore.get())) {
			lastRobotStore.set('');
		}
	}
}
