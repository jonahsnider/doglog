// Reads swerve values from entries, shared by the swerve widget's drawing code
import type { Entry } from '@/data/data-store';
import type { Value } from '@/data/samples';
import { numberField, structField } from '@/data/struct-fields';
import { widgetRoles } from '@/widgets/widget-info';
import type { RoleOption, WidgetBinding } from '@/widgets/widget-type';

export type Role = keyof typeof widgetRoles.swerve;

const roles = Object.values(widgetRoles.swerve).map((role) => role.id);

// WPILib 2027 renamed SwerveModuleState to SwerveModuleVelocity and ChassisSpeeds to ChassisVelocities
const structRoles: Partial<Record<string, Role>> = {
	'struct:SwerveModuleState[]': 'states',
	'struct:SwerveModuleVelocity[]': 'states',
	'struct:SwerveModulePosition[]': 'positions',
	'struct:ChassisSpeeds': 'speeds',
	'struct:ChassisVelocities': 'speeds',
	'struct:Rotation2d': 'heading',
};

/** The one role an entry has, none if the swerve widget doesn't accept it */
export function swerveRoles(entry: Entry): RoleOption[] {
	const role = entry.kind === 'number' ? 'heading' : structRoles[entry.type];
	return role === undefined ? [] : [widgetRoles.swerve[role]];
}

/** What a binding is used for, `undefined` without an entry */
export function swerveRole(binding: WidgetBinding): Role | undefined {
	return roles.find((role) => role === binding.role?.id);
}

/** A module's speed, `speed` in SwerveModuleState or `velocity` in SwerveModuleVelocity */
function moduleSpeed(module: unknown): number {
	const speed = structField(module, 'speed');
	return typeof speed === 'number' ? speed : numberField(module, 'velocity');
}

export type Module = { angle: number; speed: number };

export function readModules(value: Value | undefined, role: Role): Module[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map((module) => ({
		angle: numberField(structField(module, 'angle'), 'value'),
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
