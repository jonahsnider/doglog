import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import type { QuaternionTuple, Vector3Tuple } from 'three';

/** A pinhole camera in the field model's coordinates, looking along its local -Z with +Y up */
export type CameraMatch = {
	position: Vector3Tuple;
	quaternion: QuaternionTuple;
	verticalFov: number;
	aspect: number;
};

const matches = createAtom<ReadonlyMap<string, CameraMatch>>(new Map());

/** Camera matches are view state, like orbiting a field, not dashboard data. */
export function setCameraMatch(paneId: string, match: CameraMatch | undefined) {
	matches.set((current) => {
		const next = new Map(current);
		if (match) {
			next.set(paneId, match);
		} else {
			next.delete(paneId);
		}
		return next;
	});
}

export function useCameraMatch(paneId: string) {
	return useSelector(matches, (current) => current.get(paneId));
}
