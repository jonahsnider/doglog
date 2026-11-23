import type { Entry } from '@/data/data-store';

export type MatchType = 'practice' | 'qualification' | 'elimination';

/** A match run by the field (FMS) */
export interface Match {
	/** The event, if the field sent one, and the match, ex. `CAPH Q12` */
	label: string;
	type: MatchType;
}

/** What a log's file name says about it */
export interface LogName {
	/** When the log started, from the robot's clock once the Driver Station set it */
	date: Date;
	/** The event for a log from the field that wasn't recorded during a match */
	event?: string;
	/** The match the log is from, `undefined` for logs from outside a match */
	match: Match | undefined;
}

// WPILib's DataLogManager, ex. `FRC_20260315_143000_CAPH_Q12.wpilog`
// The event name is empty when the field doesn't send one, ex. `FRC_20241110_165657__Q68.wpilog`.
// Match numbers can be 0, ex. practice matches on a practice field.
const wpilibPattern = /^(?:FRC|WPILIB)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(_.*_[PQE]\d+)?\.wpilog$/u;
// AdvantageKit's WPILOGWriter, ex. `akit_26-03-15_14-30-00_caph_q12.wpilog`, or `.wpilogxz` when compressed
const advantageKitPattern = /^akit_(\d{2})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(_.+)?\.wpilog(?:xz)?$/u;
const advantageKitMatchPattern = /_[pqe]\d+$/u;
const matchTypes: Record<string, MatchType> = {
	P: 'practice',
	Q: 'qualification',
	E: 'elimination',
};

/**
 * Read the date, event, and match from a log's file name.
 * Returns `undefined` for other names, including logs that haven't been dated yet,
 * since they're renamed once the Driver Station connects.
 */
export function parseLogName(name: string): LogName | undefined {
	const wpilib = wpilibPattern.exec(name);
	const advantageKit = wpilib ? undefined : advantageKitPattern.exec(name);
	const match = wpilib ?? advantageKit;
	if (!match) {
		return undefined;
	}

	const part = (group: number) => Number(match[group]);
	const [month, day, hour, minute, second] = [part(2), part(3), part(4), part(5), part(6)];
	// Both name logs with the robot's clock, which is UTC on a roboRIO
	const date = new Date(Date.UTC((wpilib ? 0 : 2000) + part(1), month - 1, day, hour, minute, second));
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
		// Don't display invalid timestamps as normalized dates
		return undefined;
	}

	const suffix = match[7];
	if (suffix === undefined) {
		return { date, match: undefined };
	}
	if (advantageKit && !advantageKitMatchPattern.test(suffix)) {
		return { date, event: suffix.slice(1).toUpperCase(), match: undefined };
	}
	// Ex. `_CAPH_Q12`, `_caph_q12`, or `__Q68` without an event name
	const parts = suffix.split('_').filter(Boolean);
	const label = parts.join(' ').toUpperCase();
	// The last part is the match, ex. `Q12`
	return { date, match: { label, type: matchTypes[parts.at(-1)![0]!.toUpperCase()]! } };
}

// Where logs keep the Driver Station's match info: NetworkTables' FMSInfo when NT is logged, or AdvantageKit's inputs
const matchInfoPrefixes = ['/NT:/FMSInfo/', '/DriverStation/'];
// The Driver Station's match type numbers, 0 is outside of matches
const matchTypeNumbers: Record<number, { type: MatchType; letter: string }> = {
	1: { type: 'practice', letter: 'P' },
	2: { type: 'qualification', letter: 'Q' },
	3: { type: 'elimination', letter: 'E' },
};

/** Read the match a log is from out of its Driver Station data, which is still right after the log is renamed */
export function readLogMatch(getEntry: (name: string) => Entry | undefined): Match | undefined {
	for (const prefix of matchInfoPrefixes) {
		const latest = (name: string) => getEntry(prefix + name)?.samples.valueAt(Infinity);
		const matchType = matchTypeNumbers[Number(latest('MatchType'))];
		const number = latest('MatchNumber');
		if (matchType === undefined || typeof number !== 'number' || number < 0) {
			continue;
		}
		const event = latest('EventName');
		const label = [typeof event === 'string' ? event : '', `${matchType.letter}${number}`].filter(Boolean).join(' ');
		return { label: label.toUpperCase(), type: matchType.type };
	}
	return undefined;
}
