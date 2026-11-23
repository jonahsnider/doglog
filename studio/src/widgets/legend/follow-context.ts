import { createContext } from 'react';
import type { DriverStation } from '@/three/field-poses';

/** Follows robots with a 3D field's camera, from its legend */
export type FollowControls = {
	/** Follow the robot of a binding, moving with it or `from` a driver station */
	follow: (bindingId: string, from?: DriverStation) => void;
	stop: () => void;
	/** The robot's driver station at the cursor, if it's logged */
	robotStation: () => DriverStation | undefined;
};

export const FollowContext = createContext<FollowControls | undefined>(undefined);
