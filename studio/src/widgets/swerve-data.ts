// Reads swerve values from entries, shared by the swerve widget's drawing code
import type { Entry } from '@/data/data-store';
import type { Value } from '@/data/samples';

export type Role = 'states' | 'positions' | 'speeds' | 'heading';

// WPILib 2027 renamed SwerveModuleState to SwerveModuleVelocity and ChassisSpeeds to ChassisVelocities
const structRoles: Partial<Record<string, Role>> = {
	'struct:SwerveModuleState[]': 'states',
	'struct:SwerveModuleVelocity[]': 'states',
	'struct:SwerveModulePosition[]': 'positions',
	'struct:ChassisSpeeds': 'speeds',
	'struct:ChassisVelocities': 'speeds',
	'struct:Rotation2d': 'heading',
};

/** What a bound entry is used for, `undefined` if the swerve widget doesn't accept it */
export function swerveRole(entry: Entry): Role | undefined {
	return entry.kind === 'number' ? 'heading' : structRoles[entry.type];
}

function field(struct: unknown, name: string): unknown {
	return typeof struct === 'object' && struct !== null && !Array.isArray(struct)
		? Reflect.get(struct, name)
		: undefined;
}

export function numberField(struct: unknown, name: string): number {
	const value = field(struct, name);
	return typeof value === 'number' ? value : 0;
}

/** A module's speed, `speed` in SwerveModuleState or `velocity` in SwerveModuleVelocity */
function moduleSpeed(module: unknown): number {
	const speed = field(module, 'speed');
	return typeof speed === 'number' ? speed : numberField(module, 'velocity');
}

type Module = { angle: number; speed: number };

export function readModules(value: Value | undefined, role: Role): Module[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	return value.map((module) => ({
		angle: numberField(field(module, 'angle'), 'value'),
		speed: role === 'states' ? moduleSpeed(module) : 0,
	}));
}

type HistoryMax = { scanned: number; speed: number; omega: number };

/** Fastest speeds in each entry's history, updated with only the samples added since the last read */
const historyMaxes = new WeakMap<Entry, HistoryMax>();

export function historyMax(entry: Entry, role: Role): HistoryMax {
	let max = historyMaxes.get(entry);
	if (!max) {
		max = { scanned: 0, speed: 0, omega: 0 };
		historyMaxes.set(entry, max);
	}

	const { values, length } = entry.samples;
	// Trimming live history removes the oldest samples, rescan what's left
	if (length < max.scanned) {
		max.scanned = 0;
	}
	for (let index = max.scanned; index < length; index++) {
		const value = values[index];
		if (role === 'states' && Array.isArray(value)) {
			for (const module of value) {
				max.speed = Math.max(max.speed, Math.abs(moduleSpeed(module)));
			}
		} else if (role === 'speeds') {
			max.speed = Math.max(max.speed, Math.hypot(numberField(value, 'vx'), numberField(value, 'vy')));
			max.omega = Math.max(max.omega, Math.abs(numberField(value, 'omega')));
		}
	}
	max.scanned = length;
	return max;
}
