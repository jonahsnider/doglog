import { useMemo } from 'react';
import type { Matrix4 } from 'three';
import type { LoadedRobot } from '@/three/robot-loading';

/** A robot's body, and its parts placed by `poses` in their order or where the CAD placed them */
export function RobotModel({ robot, poses }: { robot: LoadedRobot; poses: readonly (Matrix4 | undefined)[] }) {
	// Models can only be in one scene, each widget draws its own copy
	const body = useMemo(() => robot.body.clone(), [robot]);
	const parts = useMemo(
		() => robot.parts.map((model, index) => ({ model: model.clone(), config: robot.config.parts[index]! })),
		[robot],
	);
	const placements = useMemo(
		() =>
			parts.map(({ config }, index) => {
				const pose = poses[index];
				return pose ? pose.clone().multiply(config.zero) : config.rest;
			}),
		[parts, poses],
	);

	return (
		<>
			<group matrix={robot.config.body.transform} matrixAutoUpdate={false}>
				<primitive object={body} />
			</group>
			{parts.map(({ model }, index) => (
				<group key={model.uuid} matrix={placements[index]} matrixAutoUpdate={false}>
					<primitive object={model} />
				</group>
			))}
		</>
	);
}
