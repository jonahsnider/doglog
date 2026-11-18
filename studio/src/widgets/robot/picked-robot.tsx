import { type ReactNode, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { Entry } from '@/data/data-store';
import { poseMatrix } from '@/three/poses';
import { useLoadedRobot } from '@/three/robot-loading';
import { RobotModel } from '@/three/robot-model';
import { allowProjectAccess, useRobotProject } from '@/three/robot-projects';
import { SwerveRobot } from '@/three/swerve-robot';
import { useCursorTime } from '@/timeline/timeline';
import { defaultRobot } from '@/widgets/robot/robot-option';

/**
 * The robot the Robot option picked, with its parts placed by the `parts` entry's poses at the cursor. When it can't be
 * drawn, the simple swerve robot is drawn instead, with a note saying why.
 */
export function usePickedRobot(name: string, parts: Entry | undefined): { robot: ReactNode; note: ReactNode } {
	const time = useCursorTime();
	const project = useRobotProject(name === defaultRobot ? '' : name);
	const { state, retry } = useLoadedRobot(name === defaultRobot ? undefined : (project ?? undefined));
	const value = parts && time !== undefined ? parts.samples.valueAt(time) : undefined;
	// Only recomputed when the poses change
	const poses = useMemo(() => (Array.isArray(value) ? value.map((pose) => poseMatrix(pose)) : []), [value]);

	if (name === defaultRobot) {
		return { robot: <SwerveRobot />, note: undefined };
	}
	if (project === null) {
		return { robot: <SwerveRobot />, note: `${name} isn't added on this device` };
	}
	if (state?.status === 'loaded') {
		return { robot: <RobotModel robot={state.robot} poses={poses} />, note: undefined };
	}
	if (state?.status === 'error') {
		return {
			robot: <SwerveRobot />,
			note: (
				<>
					<span className="truncate">{state.message}</span>
					{state.needsAccess && project && (
						<Button
							variant="outline"
							size="xs"
							onClick={() => {
								void allowProjectAccess(project).then((allowed) => {
									if (allowed) {
										retry();
									}
									return undefined;
								});
							}}
						>
							Allow access
						</Button>
					)}
				</>
			),
		};
	}
	return { robot: null, note: `Loading ${name}…` };
}
