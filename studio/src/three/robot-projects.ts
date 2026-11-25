// Robot projects the user added, read where they are: the desktop app remembers folder paths, and the web app keeps
// directory handles. Both are kept in IndexedDB, which can store handles.
import { useSelector } from '@tanstack/react-store';
import { useEffect } from 'react';
import { createAtom } from '@tanstack/store';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { get, set } from 'idb-keyval';
import type { ReadProjectFile } from '@/three/robot-config';

/** A robot in a project the user added, a project with several robots has an entry for each */
export type RobotProject = {
	/** The robot's name from its config, robots are picked by name so shared dashboards work on other devices */
	readonly name: string;
	/** The project folder on desktop */
	readonly path?: string;
	/** The project folder on the web */
	readonly handle?: FileSystemDirectoryHandle;
};

const storageKey = 'doglog-studio:robot-projects';
const projectsStore = createAtom<readonly RobotProject[] | undefined>(undefined);

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

/** A project by its robot's name, `null` if there's none, or `undefined` while projects load */
export function useRobotProject(name: string): RobotProject | null | undefined {
	useEffect(startLoading, []);
	const projects = useSelector(projectsStore);
	return projects && (projects.find((project) => project.name === name) ?? null);
}

/** Whether projects can be added, the web app needs a Chromium browser to keep access to folders */
export const canAddRobotProjects = STUDIO_DESKTOP || 'showDirectoryPicker' in globalThis;

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

/**
 * Pick a project folder and add its robots, replacing robots with the same names and the folder's robots from when it
 * was added before. Returns the first robot's name.
 */
export async function addRobotProject(): Promise<string | undefined> {
	let project: Omit<RobotProject, 'name'>;
	if (STUDIO_DESKTOP) {
		const path = await openDialog({ directory: true, title: 'Add a robot project' });
		if (path === null) {
			return undefined;
		}
		project = { path };
	} else {
		try {
			project = { handle: await window.showDirectoryPicker!({ mode: 'read' }) };
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return undefined;
			}
			throw error;
		}
	}

	const { readRobotConfigs } = await import('@/three/robot-config');
	const names = (await readRobotConfigs(projectFileReader({ name: '', ...project }))).map(({ name }) => name);
	const others = await savedProjectsWithout({ name: '', ...project }, names);
	// Removed first so a project added again is a new object, and its models load again with any changes
	await saveProjects(others);
	await saveProjects([...others, ...names.map((name) => ({ name, ...project }))]);
	return names[0];
}

/** Remove the project of the robot named `name`, with all its robots */
export async function removeRobotProject(name: string): Promise<void> {
	const project = getRobotProjects().find((other) => other.name === name);
	if (project !== undefined) {
		await saveProjects(await savedProjectsWithout(project));
	}
}
