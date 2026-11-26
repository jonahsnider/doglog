import { createAtom } from '@tanstack/store';
import type { Entry } from '@/data/data-store';
import { FieldEntry } from '@/data/field-entry';
import { setLiveValue } from '@/data/live-connection';
import type { NtPublishType, NtValue } from '@/nt/client';
import { inferUnit } from '@/data/units';
import { evaluateExpression, roundNumber, typedFraction } from '@/tuning/expression';
import type { RoleOption } from '@/widgets/widget-type';

/** Where WPILib publishes tunables in NetworkTables, including DogLog's, and where DogLog did before 2027 */
export const tunablesPrefixes = ['/Tunables/', '/Tunable/'];

type ScalarType = 'double' | 'float' | 'int' | 'boolean' | 'string';
const scalarTypes = new Set<string>(['double', 'float', 'int', 'boolean', 'string'] satisfies ScalarType[]);

export type TunableScalar = number | boolean | string;
export type TunableValue = TunableScalar | readonly TunableScalar[];

export type Tunable = {
	entry: Entry;
	/** Its name in its table, ex. `kP` for `/Tunables/Elevator/kP` */
	label: string;
	/** Its table's path under `/Tunables` (or `/Tunable`), ex. `Elevator`, empty for tunables at the top level */
	table: string;
	type: NtPublishType;
	/** The type of the value, or of each element of an array */
	scalarType: ScalarType;
	array: boolean;
	/** Whether the robot accepts changes to it */
	mutable: boolean;
};

/** The ways an array can be edited, as the tuning widget's roles: a list, or a table of pairs or triplets */
export const arrayLayouts = [
	{ id: 'list', label: 'List' },
	{ id: 'pairs', label: 'Pairs' },
	{ id: 'triplets', label: 'Triplets' },
] as const satisfies RoleOption[];

/** How many elements each row of an array laid out as `role` holds */
export function rowSize(role: RoleOption | undefined): number {
	return Math.max(1, arrayLayouts.findIndex(({ id }) => id === role?.id) + 1);
}

/** A property the robot publishes with a tunable's topic, ex. `tupleSize` */
function topicProperty(entry: Entry, key: string): unknown {
	const { properties } = entry.metadata;
	// Logs nest NT topic properties in `properties`
	return (
		entry.metadata[key] ??
		(typeof properties === 'object' && properties !== null ? Reflect.get(properties, key) : undefined)
	);
}

/** The layout the robot asks for with the `tupleSize` property, ex. DogLog's interpolating map tunables are pairs */
export function inferArrayLayout(entry: Entry): RoleOption {
	const tupleSize = topicProperty(entry, 'tupleSize');
	return (typeof tupleSize === 'number' ? arrayLayouts[tupleSize - 1] : undefined) ?? arrayLayouts[0];
}

/** The value in the robot's code, from the topic's `default` property, `undefined` when the robot doesn't publish one */
export function defaultValue({ entry, scalarType, array }: Tunable): TunableValue | undefined {
	const value = topicProperty(entry, 'default');
	const jsType = scalarType === 'boolean' || scalarType === 'string' ? scalarType : 'number';
	const valid = (element: unknown): element is TunableScalar => typeof element === jsType;
	if (array) {
		return Array.isArray(value) && value.every((element) => valid(element)) ? value : undefined;
	}
	return valid(value) ? value : undefined;
}

/** The type of a tunable value, or of an array's elements, `undefined` for types that can't be tuned */
function scalarTypeOf(type: string): ScalarType | undefined {
	const scalar = type.endsWith('[]') ? type.slice(0, -2) : type;
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Checked by the set
	return scalarTypes.has(scalar) ? (scalar as ScalarType) : undefined;
}

/**
 * Whether an entry is a tunable value Studio can change. Robust tunables, which split their value and changes into two
 * topics, aren't supported, and neither are the elements of arrays, which aren't topics of their own.
 */
export function isTunable(entry: Entry): boolean {
	return (
		tunablesPrefixes.some((prefix) => entry.name.startsWith(prefix)) &&
		scalarTypeOf(entry.type) !== undefined &&
		entry.metadata['robust'] !== true &&
		!(entry instanceof FieldEntry)
	);
}

/** The tunable values in live entries, see `isTunable()` */
export function findTunables(entries: readonly Entry[]): Tunable[] {
	return entries.flatMap((entry) => {
		const prefix = tunablesPrefixes.find((other) => entry.name.startsWith(other));
		const scalarType = scalarTypeOf(entry.type);
		if (prefix === undefined || scalarType === undefined || !isTunable(entry)) {
			return [];
		}
		const path = entry.name.slice(prefix.length);
		const slash = path.lastIndexOf('/');
		return [
			{
				entry,
				label: path.slice(slash + 1),
				table: slash === -1 ? '' : path.slice(0, slash),
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Every scalar type and its array are publishable
				type: entry.type as NtPublishType,
				scalarType,
				array: entry.type.endsWith('[]'),
				mutable: entry.metadata['mutable'] !== false,
			},
		];
	});
}

function isScalar(value: unknown): value is TunableScalar {
	return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string';
}

function isScalarArray(value: unknown): value is TunableScalar[] {
	return Array.isArray(value) && value.every((element) => isScalar(element));
}

export function currentValue({ entry, array }: Tunable): TunableValue | undefined {
	const value = entry.samples.values.at(-1);
	if (array) {
		return isScalarArray(value) ? value : undefined;
	}
	return isScalar(value) ? value : undefined;
}

/**
 * Parse what the user typed for a tunable, or one element of an array, numbers can be arithmetic. `undefined` if it
 * isn't a valid value for its type.
 */
export function parseTunableValue({ entry, scalarType }: Tunable, text: string): TunableScalar | undefined {
	if (scalarType === 'string') {
		return text;
	}
	if (scalarType === 'boolean') {
		const trimmed = text.trim().toLowerCase();
		return trimmed === 'true' ? true : trimmed === 'false' ? false : undefined;
	}
	// Typed units convert to the tunable's, ex. `5 ft` for a length in meters
	const value = evaluateExpression(text, inferUnit(entry));
	return value === undefined || (scalarType === 'int' && !Number.isInteger(value)) ? undefined : value;
}

/** Whether `text` is written differently than its number is, ex. `10 + 1` for 11 */
export function isExpression(tunable: Tunable, text: string, parsed: TunableScalar | undefined): boolean {
	return tunable.scalarType !== 'string' && parsed !== undefined && Number(text) !== parsed;
}

/** Format a value to be typed, or `rounded` to be read at a glance, see `roundNumber()` */
export function formatTunableValue(value: TunableValue | undefined, { rounded = false } = {}): string {
	if (value === undefined) {
		return '';
	}
	if (typeof value === 'object') {
		return value.map((element) => formatTunableValue(element, { rounded })).join(', ');
	}
	return rounded && typeof value === 'number' ? roundNumber(value) : String(value);
}

/** What's typed in a value's field, or in each of an array's, staged as soon as it's valid */
export type Draft = string | readonly string[];

/** The value a draft stands for, `undefined` until every element of an array is valid */
export function parseDraft(tunable: Tunable, draft: Draft): TunableValue | undefined {
	if (typeof draft === 'string') {
		return parseTunableValue(tunable, draft);
	}
	const values = draft.map((text) => parseTunableValue(tunable, text));
	return values.includes(undefined) ? undefined : values.filter((value) => value !== undefined);
}

/**
 * What's left typed once a valid draft is committed: fractions stay as they're typed, ex. `2/3`, and the rest is
 * replaced by its value, ex. `11` for `10 + 1`. `undefined` when nothing typed is left.
 */
export function committedDraft(tunable: Tunable, draft: Draft): Draft | undefined {
	const texts = typeof draft === 'string' ? [draft] : draft;
	const fractions = texts.map((text) => (tunable.scalarType === 'string' ? undefined : typedFraction(text)));
	if (fractions.every((fraction) => fraction === undefined)) {
		return undefined;
	}
	const committed = texts.map(
		(text, index) => fractions[index] ?? formatTunableValue(parseTunableValue(tunable, text)),
	);
	return typeof draft === 'string' ? committed[0]! : committed;
}

/** `draft`, unless it's valid but stands for another value than the one shown, ex. after the robot changed a kept fraction */
export function shownDraft(
	tunable: Tunable,
	draft: Draft | undefined,
	shown: TunableValue | undefined,
): Draft | undefined {
	if (draft === undefined) {
		return undefined;
	}
	const value = parseDraft(tunable, draft);
	return value === undefined || sameTunableValue(value, shown) ? draft : undefined;
}

export function sameTunableValue(a: TunableValue | undefined, b: TunableValue | undefined): boolean {
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((element, index) => element === b[index]);
	}
	return a === b;
}

/** Each applied tunable's value before it was last applied, by entry name. Kept until Studio reloads. */
export const previousStore = createAtom<Readonly<Record<string, TunableValue>>>({});

/** Send `staged` values (by entry name) of `tunables` to the robot together */
export async function applyTunables(
	tunables: readonly Tunable[],
	staged: Readonly<Record<string, TunableValue>>,
): Promise<void> {
	const changed = tunables.filter(({ entry }) => entry.name in staged);
	const before = Object.fromEntries(
		changed.flatMap((tunable) => {
			const value = currentValue(tunable);
			return value === undefined ? [] : [[tunable.entry.name, value]];
		}),
	);
	await Promise.all(
		changed.map(({ entry, type }) =>
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Arrays only hold elements of their type
			setLiveValue(entry.name, type, staged[entry.name] as NtValue),
		),
	);
	previousStore.set((previous) => ({ ...previous, ...before }));
}

/** Order tables so each one comes right before the tables nested in it */
export function compareTables(a: string, b: string): number {
	const aSegments = a.split('/');
	const bSegments = b.split('/');
	for (let index = 0; index < Math.min(aSegments.length, bSegments.length); index++) {
		const order = aSegments[index]!.localeCompare(bSegments[index]!, undefined, { numeric: true });
		if (order !== 0) {
			return order;
		}
	}
	return aSegments.length - bSegments.length;
}
