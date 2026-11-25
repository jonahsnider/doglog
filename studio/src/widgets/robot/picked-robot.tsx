import * as stylex from '@stylexjs/stylex';
import { type ReactNode, useMemo } from 'react';
import { Button } from '@astryxdesign/core/Button';
import type { Entry } from '@/data/data-store';
import { poseMatrix } from '@/three/poses';
import { useLoadedRobot } from '@/three/robot-loading';
import { RobotModel } from '@/three/robot-model';
import { allowProjectAccess, useRobotProject } from '@/three/robot-projects';
import { SwerveDrivebase } from '@/three/swerve-drivebase';
import { useCursorTime } from '@/timeline/timeline';
import { defaultRobot } from '@/widgets/robot/robot-option';

const styles = stylex.create({
	message: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
});

/**
 * The robot the Robot option picked, with its parts placed by the `parts` entry's poses at the cursor. When it can't be
 * drawn, the swerve drivebase is drawn instead, with a note saying why.
 */
export function usePickedRobot(
	name: string,
	parts: Entry | undefined,
): { robot: ReactNode; note: ReactNode; loading?: true } {
	const time = useCursorTime();
	const project = useRobotProject(name === defaultRobot ? '' : name);
	const { state, retry } = useLoadedRobot(name === defaultRobot ? undefined : (project ?? undefined));
	const value = parts && time !== undefined ? parts.samples.valueAt(time) : undefined;
	// oxlint-disable-next-line studio/no-manual-memo -- Without it, React Compiler reruns this whenever `time` changes, not just when the value does
	const poses = useMemo(() => (Array.isArray(value) ? value.map((pose) => poseMatrix(pose)) : []), [value]);

	if (name === defaultRobot) {
		return { robot: <SwerveDrivebase />, note: undefined };
	}
	if (project === null) {
		return { robot: <SwerveDrivebase />, note: `${name} isn't added on this device` };
	}
	if (state?.status === 'loaded') {
		return { robot: <RobotModel robot={state.robot} poses={poses} />, note: undefined };
	}
	if (state?.status === 'error') {
		return {
			robot: <SwerveDrivebase />,
			note: (
				<>
					<span {...stylex.props(styles.message)}>{state.message}</span>
					{state.needsAccess && project && (
						<Button
							label="Allow access"
							size="sm"
							onClick={() => {
								void allowProjectAccess(project).then((allowed) => {
									if (allowed) {
										retry();
									}
									return undefined;
								});
							}}
						/>
					)}
				</>
			),
		};
	}
	return { robot: null, note: `Loading ${name}…`, loading: true };
}
