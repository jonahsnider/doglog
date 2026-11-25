import { useMemo } from 'react';
import { Box3, BoxGeometry, BufferGeometry, type Matrix4, type Object3D, Vector3 } from 'three';
import { deinterleaveGeometry, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isMesh, type LoadedRobot } from '@/three/robot-loading';

/** How see-through ghosts are, for both CAD models and the swerve drivebase */
export const ghostOpacity = 0.6;

/**
 * CAD meshes aren't hit by the pointer or by finding what's under it to zoom toward, which would test each of a
 * robot's millions of triangles on every pointer move. Each model has a `HitBox` instead.
 */
function skipRaycast(): void {}

/** Each model's bounds as a box, see `HitBox` */
const hitBoxes = new WeakMap<Object3D, BufferGeometry>();

function hitBoxGeometry(model: Object3D): BufferGeometry {
	let geometry = hitBoxes.get(model);
	if (geometry === undefined) {
		model.updateMatrixWorld(true);
		const box = new Box3().setFromObject(model);
		const size = box.getSize(new Vector3());
		const center = box.getCenter(new Vector3());
		geometry = box.isEmpty()
			? new BufferGeometry()
			: new BoxGeometry(size.x, size.y, size.z).translate(center.x, center.y, center.z);
		hitBoxes.set(model, geometry);
	}
	return geometry;
}

/** An invisible box around a model, where the pointer hits it */
function HitBox({ model }: { model: Object3D }) {
	return (
		<mesh geometry={hitBoxGeometry(model)}>
			<meshBasicMaterial visible={false} />
		</mesh>
	);
}

/** Each model's meshes merged into one geometry, see `ghostGeometry()` */
const ghostGeometries = new WeakMap<Object3D, BufferGeometry>();

/**
 * A model's meshes as one geometry in the model's coordinates, with only positions and normals, so a ghost of a CAD
 * model with thousands of parts is drawn at once instead of sorting and blending each part every frame
 */
function ghostGeometry(model: Object3D): BufferGeometry {
	let merged = ghostGeometries.get(model);
	if (merged === undefined) {
		model.updateMatrixWorld(true);
		const geometries: BufferGeometry[] = [];
		model.traverse((object) => {
			if (!isMesh(object) || !object.geometry.hasAttribute('position')) {
				return;
			}
			const source = object.geometry;
			const geometry = new BufferGeometry();
			geometry.setAttribute('position', source.getAttribute('position'));
			if (source.hasAttribute('normal')) {
				geometry.setAttribute('normal', source.getAttribute('normal'));
			}
			// Indexed and non-indexed geometries can't be merged together
			geometry.setIndex(
				source.index ?? Array.from({ length: source.getAttribute('position').count }, (_, index) => index),
			);
			// Copied so the model isn't moved, and without the interleaving some exports use, which can't be merged
			const copy = geometry.clone();
			deinterleaveGeometry(copy);
			// Every geometry needs the same attributes to be merged
			if (!copy.hasAttribute('normal')) {
				copy.computeVertexNormals();
			}
			copy.applyMatrix4(object.matrixWorld);
			geometries.push(copy);
		});
		// Merging throws without geometries, and returns null when they can't be merged
		merged = (geometries.length > 0 ? mergeGeometries(geometries) : null) ?? new BufferGeometry();
		for (const geometry of geometries) {
			geometry.dispose();
		}
		ghostGeometries.set(model, merged);
	}
	return merged;
}

/**
 * A model drawn see-through in one color with the same opacity everywhere, like a ghost of the swerve drivebase.
 * Its depth is drawn first, so only the surfaces nearest the camera are blended instead of every part behind them.
 */
function Ghost({ model, color }: { model: Object3D; color: string }) {
	const geometry = ghostGeometry(model);
	return (
		<>
			{/* Drawn with other see-through objects, after the field and robots, so it doesn't hide them */}
			<mesh geometry={geometry} renderOrder={1} raycast={skipRaycast}>
				<meshBasicMaterial colorWrite={false} transparent />
			</mesh>
			<mesh geometry={geometry} renderOrder={2} raycast={skipRaycast}>
				<meshStandardMaterial color={color} transparent opacity={ghostOpacity} depthWrite={false} />
			</mesh>
		</>
	);
}

/** A copy of a model to draw, whose meshes the pointer doesn't hit, see `skipRaycast()` */
function drawnCopy(model: Object3D): Object3D {
	const clone = model.clone();
	clone.traverse((object) => {
		if (isMesh(object)) {
			object.raycast = skipRaycast;
		}
	});
	return clone;
}

/**
 * A robot's body, and its parts placed by `poses` in their order or where the CAD placed them. With a `ghost` color,
 * it's drawn as a see-through ghost in that color.
 */
export function RobotModel({
	robot,
	poses,
	ghost,
}: {
	robot: LoadedRobot;
	poses: readonly (Matrix4 | undefined)[];
	ghost?: string;
}) {
	// Models can only be in one scene, each robot draws its own copy. Ghosts share their geometry instead.
	const body = ghost === undefined ? drawnCopy(robot.body) : robot.body;
	const parts = robot.parts.map((model, index) => ({
		model: ghost === undefined ? drawnCopy(model) : model,
		config: robot.config.parts[index]!,
	}));
	// oxlint-disable-next-line studio/no-manual-memo -- Without it, React Compiler copies the parts' meshes again whenever `poses` changes
	const placements = useMemo(
		() =>
			parts.map(({ config }, index) => {
				const pose = poses[index];
				return pose ? pose.clone().multiply(config.zero) : config.rest;
			}),
		[parts, poses],
	);
	const draw = (model: Object3D) => (
		<>
			{ghost === undefined ? <primitive object={model} /> : <Ghost model={model} color={ghost} />}
			<HitBox model={model} />
		</>
	);

	return (
		<>
			<group matrix={robot.config.body.transform} matrixAutoUpdate={false}>
				{draw(body)}
			</group>
			{parts.map(({ model }, index) => (
				<group key={model.uuid} matrix={placements[index]} matrixAutoUpdate={false}>
					{draw(model)}
				</group>
			))}
		</>
	);
}
