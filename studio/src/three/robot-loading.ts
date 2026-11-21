import { useEffect, useState } from 'react';
import { Box3, FrontSide, type Material, Mesh, MeshStandardMaterial, type Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RobotConfigError, type RobotConfig, readRobotConfig } from '@/three/robot-config';
import { ProjectAccessError, projectFileReader, type RobotProject } from '@/three/robot-projects';

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

/** `instanceof Mesh` types a mesh's material as `any` */
function isMesh(object: Object3D): object is Mesh {
	return object instanceof Mesh;
}

/** How many sizes of meshes are drawn in front of the next bigger size, halving from 1 m */
const sizeSteps = 6;

/**
 * CAD parts often have faces in the same plane as a bigger part's, ex. an insert in a plate, which flicker between
 * the two as the camera moves. Smaller meshes are drawn slightly in front, so they always win.
 */
function prepare(model: Object3D): Object3D {
	model.updateMatrixWorld(true);
	const box = new Box3();
	// Meshes share materials, so each material is copied once for each size it's used at
	const copies = new Map<string, Material>();
	const prepareMaterial = (material: Material, step: number): Material => {
		const key = `${material.uuid} ${step}`;
		let copy = copies.get(key);
		if (copy === undefined) {
			copy = material.clone();
			if (copy instanceof MeshStandardMaterial) {
				// Keep glossy exports readable. A roughness map can still make parts shiny even with roughness set to 1.
				copy.roughness = 1;
				copy.roughnessMap = null;
			}
			// CAD exports are double-sided, which shows a see-through part's far side, ex. the back of a polycarbonate panel
			// flickering against the plate it's mounted to
			if (copy.transparent) {
				copy.side = FrontSide;
			}
			// Two depth buffer steps, a few micrometers, for each size. Offsetting by the face's slope too would move parts
			// a pixel or more forward, letting hardware behind plates show through.
			copy.polygonOffset = step > 0;
			copy.polygonOffsetUnits = -2 * step;
			copies.set(key, copy);
		}
		return copy;
	};

	model.traverse((object) => {
		// glTF meshes have one material each, a mesh with several is loaded as a group of meshes
		if (isMesh(object) && !Array.isArray(object.material)) {
			const size = box.setFromObject(object).getSize(new Vector3()).length();
			const step = Math.min(sizeSteps, Math.max(0, Math.floor(-Math.log2(size))));
			object.material = prepareMaterial(object.material, step);
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
