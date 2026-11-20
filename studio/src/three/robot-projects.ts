// Robot projects the user added, read where they are: the desktop app remembers folder paths, and the web app keeps
// directory handles. Both are kept in IndexedDB, which can store handles.
import { useSelector } from '@tanstack/react-store';
import { useEffect } from 'react';
import { createAtom } from '@tanstack/store';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { get, set } from 'idb-keyval';
import type { ReadProjectFile } from '@/three/robot-config';

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

function isSameProject(a: RobotProject, b: RobotProject): Promise<boolean> {
	if (a.name !== b.name || a.path !== b.path) {
		return Promise.resolve(false);
	}
	return a.handle === undefined || b.handle === undefined
		? Promise.resolve(a.handle === b.handle)
		: a.handle.isSameEntry(b.handle);
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

const noProjects: readonly RobotProject[] = [];

export function useRobotProjects(): readonly RobotProject[] {
	useEffect(startLoading, []);
	return useSelector(projectsStore) ?? noProjects;
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

/** Reads files in a project's folder */
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

/** Pick a project folder and add its robot, replacing a project with the same robot. Returns the robot's name. */
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

	const { readRobotConfig } = await import('@/three/robot-config');
	const { name } = await readRobotConfig(projectFileReader({ name: '', ...project }));
	const others = ((await get<RobotProject[]>(storageKey)) ?? []).filter((other) => other.name !== name);
	// Removed first so a project added again is a new object, and its models load again with any changes
	await saveProjects(others);
	await saveProjects([...others, { name, ...project }]);
	return name;
}

export async function removeRobotProject(name: string): Promise<void> {
	const projects = (await get<RobotProject[]>(storageKey)) ?? [];
	await saveProjects(projects.filter((project) => project.name !== name));
}
