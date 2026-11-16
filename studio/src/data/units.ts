import type { Entry } from '@/data/data-store';

function field(object: unknown, name: string): unknown {
	return typeof object === 'object' && object !== null ? Reflect.get(object, name) : undefined;
}

export type AngleUnit = 'radians' | 'degrees' | 'rotations';

/** Unit strings in metadata and words in entry names, lowercase and without a plural `s` */
const angleUnits = new Map<string, AngleUnit>([
	['rad', 'radians'],
	['radian', 'radians'],
	['°', 'degrees'],
	['deg', 'degrees'],
	['degree', 'degrees'],
	['r', 'rotations'],
	['rot', 'rotations'],
	['rotation', 'rotations'],
	['rev', 'rotations'],
	['revolution', 'rotations'],
]);

function parseAngleUnit(text: string): AngleUnit | undefined {
	const word = text.trim().toLowerCase();
	return (
		angleUnits.get(word) ?? (word.length > 1 && word.endsWith('s') ? angleUnits.get(word.slice(0, -1)) : undefined)
	);
}

/** Words of an entry name's last part, split on punctuation and camelCase, ex. `AngleRotations` is `Angle` and `Rotations` */
function nameWords(name: string): string[] {
	const last = name.slice(name.lastIndexOf('/') + 1);
	return last.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/gu) ?? [];
}

/** The unit an entry's values are in when read as an angle, from its type, then its metadata, then its name, defaulting to radians */
export function inferAngleUnit(entry: Entry): AngleUnit {
	if (entry.type === 'struct:Rotation2d') {
		return 'radians';
	}

	// WPILib's DataLogManager keeps NT topic properties under `properties` when it records NT
	const { unit = field(entry.metadata['properties'], 'unit') } = entry.metadata;
	const metadataUnit = typeof unit === 'string' ? parseAngleUnit(unit) : undefined;
	if (metadataUnit) {
		return metadataUnit;
	}

	for (const word of nameWords(entry.name)) {
		// `R` is too short to mean rotations in a name, ex. `/Drive/FR/Speed`
		const nameUnit = word.length > 1 ? parseAngleUnit(word) : undefined;
		if (nameUnit) {
			return nameUnit;
		}
	}

	return 'radians';
}

const radiansPer: Record<AngleUnit, number> = { radians: 1, degrees: Math.PI / 180, rotations: 2 * Math.PI };

export function toRadians(value: number, unit: AngleUnit): number {
	return value * radiansPer[unit];
}

/** Short unit label, ex. `deg` */
export const angleUnitLabels: Record<AngleUnit, string> = { radians: 'rad', degrees: 'deg', rotations: 'rot' };
