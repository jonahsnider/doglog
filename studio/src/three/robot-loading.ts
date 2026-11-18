import { useEffect, useState } from 'react';
import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RobotConfigError, type RobotConfig, readRobotConfig } from '@/three/robot-config';
import { ProjectAccessError, projectFileReader, type RobotProject } from '@/three/robot-projects';

/** A robot project's config and models, ready to draw */
export type LoadedRobot = {
	readonly config: RobotConfig;
	readonly body: Object3D;
	readonly parts: readonly Object3D[];
};

export type RobotState =
	| { readonly status: 'loading' }
	| { readonly status: 'loaded'; readonly robot: LoadedRobot }
	| { readonly status: 'error'; readonly message: string; readonly needsAccess: boolean };

const loader = new GLTFLoader();

/** Without an environment map metallic CAD materials draw black, so models are lit like plastic */
function prepare(model: Object3D): Object3D {
	model.traverse((object) => {
		if (object instanceof Mesh) {
			for (const material of [object.material].flat()) {
				if (material instanceof MeshStandardMaterial) {
					material.metalness = 0;
				}
			}
		}
	});
	return model;
}

async function loadRobot(project: RobotProject): Promise<LoadedRobot> {
	const read = projectFileReader(project);
	const config = await readRobotConfig(read);
	const load = async (file: string) => {
		const contents = await read(file);
		if (contents === undefined) {
			throw new RobotConfigError(`${project.name}'s folder doesn't have ${file}`);
		}
		try {
			return prepare((await loader.parseAsync(contents, '')).scene);
		} catch (error) {
			throw new RobotConfigError(`${file} isn't a glTF binary model it can read: ${String(error)}`);
		}
	};
	const [body, ...parts] = await Promise.all([load(config.body.file), ...config.parts.map((part) => load(part.file))]);
	return { config, body, parts };
}

/** Loaded robots by project, a project added again is a new object and loads again */
const loaded = new WeakMap<RobotProject, Promise<LoadedRobot>>();

async function stateOf(project: RobotProject): Promise<RobotState> {
	let promise = loaded.get(project);
	if (promise === undefined) {
		promise = loadRobot(project);
		loaded.set(project, promise);
	}
	try {
		return { status: 'loaded', robot: await promise };
	} catch (error) {
		// Failed loads are tried again next time
		loaded.delete(project);
		return {
			status: 'error',
			message: error instanceof Error ? error.message : String(error),
			needsAccess: error instanceof ProjectAccessError,
		};
	}
}

/** Load a robot project's models. `retry` loads it again, ex. after the web app is allowed to read its folder again. */
export function useLoadedRobot(project: RobotProject | undefined): {
	state: RobotState | undefined;
	retry: () => void;
} {
	const [attempt, setAttempt] = useState(0);
	const [result, setResult] = useState<{ project: RobotProject; attempt: number; state: RobotState }>();

	useEffect(() => {
		if (project === undefined) {
			return undefined;
		}
		let cancelled = false;
		const load = async () => {
			const state = await stateOf(project);
			if (!cancelled) {
				setResult({ project, attempt, state });
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [project, attempt]);

	const current =
		result !== undefined && result.project === project && result.attempt === attempt ? result.state : undefined;
	return {
		state: project === undefined ? undefined : (current ?? { status: 'loading' }),
		retry: () => setAttempt((count) => count + 1),
	};
}
