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
	// Rotation2d, and the rotations of poses
	if (entry.kind === 'struct') {
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

/**
 * A unit any numeric entry can be in. Values convert to the measure's base unit (ex. meters, radians, °C) as
 * `value * scale + offset`, so units of the same measure convert between each other.
 */
export type Unit = {
	/** What the unit measures, ex. `length` or `length/time` for velocities */
	readonly measure: string;
	/** Short label, ex. `m/s` */
	readonly label: string;
	readonly scale: number;
	readonly offset: number;
};

type SimpleUnit = { measure: string; label: string; scale: number; offset?: number };

const simpleUnits = new Map<string, SimpleUnit>();
function addUnits(names: readonly string[], unit: SimpleUnit): void {
	for (const name of names) {
		simpleUnits.set(name, unit);
	}
}
addUnits(['m', 'meter', 'metre'], { measure: 'length', label: 'm', scale: 1 });
addUnits(['cm', 'centimeter', 'centimetre'], { measure: 'length', label: 'cm', scale: 0.01 });
addUnits(['mm', 'millimeter', 'millimetre'], { measure: 'length', label: 'mm', scale: 0.001 });
addUnits(['in', 'inch', 'inche'], { measure: 'length', label: 'in', scale: 0.0254 });
addUnits(['ft', 'foot', 'feet'], { measure: 'length', label: 'ft', scale: 0.3048 });
addUnits(['rad', 'radian'], { measure: 'angle', label: 'rad', scale: 1 });
addUnits(['°', 'deg', 'degree'], { measure: 'angle', label: 'deg', scale: Math.PI / 180 });
addUnits(['r', 'rot', 'rotation', 'rev', 'revolution'], { measure: 'angle', label: 'rot', scale: 2 * Math.PI });
addUnits(['s', 'sec', 'second'], { measure: 'time', label: 's', scale: 1 });
addUnits(['ms', 'millisecond'], { measure: 'time', label: 'ms', scale: 0.001 });
addUnits(['us', 'µs', 'microsecond'], { measure: 'time', label: 'µs', scale: 0.000_001 });
addUnits(['min', 'minute'], { measure: 'time', label: 'min', scale: 60 });
addUnits(['v', 'volt'], { measure: 'voltage', label: 'V', scale: 1 });
addUnits(['mv', 'millivolt'], { measure: 'voltage', label: 'mV', scale: 0.001 });
addUnits(['a', 'amp', 'ampere'], { measure: 'current', label: 'A', scale: 1 });
addUnits(['ma', 'milliamp', 'milliampere'], { measure: 'current', label: 'mA', scale: 0.001 });
addUnits(['°c', 'c', 'celsius'], { measure: 'temperature', label: '°C', scale: 1 });
addUnits(['°f', 'f', 'fahrenheit'], { measure: 'temperature', label: '°F', scale: 5 / 9, offset: (-32 * 5) / 9 });
addUnits(['k', 'kelvin'], { measure: 'temperature', label: 'K', scale: 1, offset: -273.15 });

/** Words too short or too common to be units in a name, ex. the `In` of `/Intake/In` */
const ambiguousNameWords = new Set(['m', 's', 'r', 'v', 'a', 'c', 'f', 'k', 'in', 'min']);

function simpleUnit(text: string): SimpleUnit | undefined {
	const word = text.trim().toLowerCase();
	return (
		simpleUnits.get(word) ?? (word.length > 1 && word.endsWith('s') ? simpleUnits.get(word.slice(0, -1)) : undefined)
	);
}

function perTime(numerator: SimpleUnit, denominator: SimpleUnit, squared: boolean): Unit | undefined {
	if (denominator.measure !== 'time' || numerator.offset !== undefined) {
		return undefined;
	}
	const scale = squared ? denominator.scale ** 2 : denominator.scale;
	return {
		measure: `${numerator.measure}/time${squared ? '²' : ''}`,
		label: `${numerator.label}/${denominator.label}${squared ? '²' : ''}`,
		scale: numerator.scale / scale,
		offset: 0,
	};
}

const rpm: Unit = { ...perTime(simpleUnits.get('rot')!, simpleUnits.get('min')!, false)!, label: 'rpm' };
const rps: Unit = { ...perTime(simpleUnits.get('rot')!, simpleUnits.get('s')!, false)!, label: 'rps' };

function fromSimple(unit: SimpleUnit): Unit {
	return { ...unit, offset: unit.offset ?? 0 };
}

/** Parses a unit like `m/s`, `meters per second`, `m/s^2`, or `RPM` */
export function parseUnit(text: string): Unit | undefined {
	const normalized = text.trim().toLowerCase().replaceAll('²', '^2').replaceAll(' per ', '/');
	if (normalized === 'rpm') {
		return rpm;
	}
	if (normalized === 'rps') {
		return rps;
	}
	const [numerator, ...denominators] = normalized.split('/').map((part) => part.trim());
	const top = numerator === undefined ? undefined : simpleUnit(numerator);
	if (!top) {
		return undefined;
	}
	if (denominators.length === 0) {
		return fromSimple(top);
	}
	const [first, second] = denominators;
	const squared = first!.endsWith('^2') || second !== undefined;
	const bottom = simpleUnit(first!.replace(/\^2$/u, ''));
	return bottom && (second === undefined || simpleUnit(second) === bottom) ? perTime(top, bottom, squared) : undefined;
}

/** A unit from the words of a name's last part, ex. `VelocityMetersPerSec` is `m/s` */
function unitInName(name: string): Unit | undefined {
	const words = nameWords(name).map((word) => word.toLowerCase());
	for (const [index, word] of words.entries()) {
		if (word === 'rpm') {
			return rpm;
		}
		const unit = ambiguousNameWords.has(word) ? undefined : simpleUnit(word);
		if (!unit) {
			continue;
		}
		if (words[index + 1] === 'per') {
			const denominator = words[index + 2];
			const squared = words[index + 3] === 'squared' || words[index + 3] === 'sq';
			const bottom = denominator === undefined ? undefined : simpleUnit(denominator);
			return bottom ? perTime(unit, bottom, squared) : undefined;
		}
		return fromSimple(unit);
	}
	return undefined;
}

/**
 * The unit of a numeric entry, from its metadata's `unit` (or NT `properties.unit`), then a unit word in its name.
 * `undefined` when neither says, so values are shown as logged.
 */
export function inferUnit(entry: Entry): Unit | undefined {
	const { unit = field(entry.metadata['properties'], 'unit') } = entry.metadata;
	return (typeof unit === 'string' ? parseUnit(unit) : undefined) ?? unitInName(entry.name);
}

/** Converts `value` from one unit to another of the same measure */
export function convertUnit(value: number, from: Unit, to: Unit): number {
	return (value * from.scale + from.offset - to.offset) / to.scale;
}
