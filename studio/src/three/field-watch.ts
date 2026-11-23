// Following a robot from a driver station with the field widget's 3D camera, see `FieldCameraRig`
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Vector3 } from 'three';

/**
 * Seconds the camera takes to turn most of the way toward the robot, so noise in the robot's pose doesn't shake the
 * view
 */
const smoothing = 0.2;
/** Longest frame the smoothing steps over, so the first frame after the scene was idle doesn't skip to the robot */
const maxStep = 0.1;

/**
 * Keeps the camera at a driver station, turning it smoothly toward a robot. `look` puts the camera at `from`, looking
 * at `aim`. The returned function watches the robot at `robot` from `from`, or stops with `undefined`. Use inside the
 * scene's canvas.
 */
export function useDriverStationWatch(look: (aim: Vector3, from: Vector3) => void) {
	/** Where the camera is, where it looks, and the robot it turns toward */
	const watching = useRef<{ from: Vector3; aim: Vector3; robot: Vector3 }>(undefined);

	useFrame((_, delta) => {
		const watched = watching.current;
		if (watched && watched.aim.distanceToSquared(watched.robot) > 1e-8) {
			watched.aim.lerp(watched.robot, 1 - Math.exp(-Math.min(delta, maxStep) / smoothing));
			// Looking draws another frame, until the camera faces the robot
			look(watched.aim.clone(), watched.from);
		}
	});

	return (robot: Vector3 | undefined, from?: Vector3) => {
		const watched = watching.current;
		if (robot === undefined || from === undefined) {
			watching.current = undefined;
			return;
		}
		// Starts by looking at the robot, from a new driver station
		const aim = watched?.from.equals(from) === true ? watched.aim : robot.clone();
		watching.current = { from: from.clone(), aim, robot: robot.clone() };
		look(aim.clone(), from);
	};
}
