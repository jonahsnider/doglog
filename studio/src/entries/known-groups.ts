import FlameIcon from 'lucide-react/icons/flame';
import Gamepad2Icon from 'lucide-react/icons/gamepad-2';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import type { ComponentType, SVGProps } from 'react';
import LimelightIcon from '@/entries/logos/limelight.svg?react';
import PhotonVisionIcon from '@/entries/logos/photonvision.svg?react';
import SpotIcon from '@/entries/logos/spot.svg?react';
import { controllerPort } from '@/widgets/controller/data';

/** A group of entries a device or library logs, marked with its icon in the entry browser */
export type KnownGroup = {
	/** Shown in the mark's tooltip, ex. `Limelight` */
	readonly name: string;
	/** A Lucide icon, or a single color SVG logo with `fill="currentColor"` imported with `?react` */
	readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Where DogLog's tunable values are: NetworkTables' `/Tunables` table, streamed or logged under `/NT:`, and
 * `/Robot/Tunable` from DogLog releases before 2027
 */
const tunablePaths = new Set(['/Tunables', '/NT:/Tunables', '/Robot/Tunable']);

/** Where Team 581's Spot vision system publishes, and where its topics are logged from NetworkTables */
const spotPaths = new Set(['/Spot', '/NT:/Spot']);

/** What the group at `path` is, ex. a Limelight for `/NT:/limelight-front`, `undefined` for other groups */
export function knownGroup(path: string): KnownGroup | undefined {
	// Only the group a controller's entries are directly in, ex. `/DS:joystick2` but not `/DS:joystick2/axes`
	const port = controllerPort(`${path}/`);
	if (port !== undefined && controllerPort(path) === undefined) {
		return { name: `Controller ${port}`, icon: Gamepad2Icon };
	}

	const segment = path.slice(path.lastIndexOf('/') + 1);
	// Limelights publish to `/limelight`, or `/limelight-<name>` once they're named
	if (/^limelight(?:-|$)/iu.test(segment)) {
		return { name: 'Limelight', icon: LimelightIcon };
	}

	if (segment.toLowerCase() === 'photonvision') {
		return { name: 'PhotonVision', icon: PhotonVisionIcon };
	}

	if (spotPaths.has(path)) {
		return { name: 'Spot', icon: SpotIcon };
	}

	// Team 581's Trailblazer path follower logs to DogLog under `Trailblazer`
	if (segment === 'Trailblazer') {
		return { name: 'Trailblazer', icon: FlameIcon };
	}

	if (tunablePaths.has(path)) {
		return { name: 'Tunable values', icon: SlidersHorizontalIcon };
	}

	return undefined;
}
