export type MatchType = 'practice' | 'qualification' | 'elimination';

/** A match run by the field (FMS) */
interface Match {
	/** The event, if the field sent one, and the match, ex. `CAPH Q12` */
	label: string;
	type: MatchType;
}

/** What a log's file name says about it */
export interface LogName {
	/** When the log started, from the robot's clock once the Driver Station set it */
	date: Date;
	/** The match the log is from, `undefined` for logs from outside a match */
	match: Match | undefined;
}

// WPILib's DataLogManager, ex. `FRC_20260315_143000_CAPH_Q12.wpilog`
const wpilibPattern = /^FRC_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(_.*)?\.wpilog$/u;
// The event name is empty when the field doesn't send one, ex. `FRC_20241110_165657__Q68.wpilog`.
// Match 0 isn't from the field, the Driver Station reports it outside of matches.
const wpilibMatchPattern = /_[PQE][1-9]\d*$/u;
// AdvantageKit's WPILOGWriter, ex. `akit_26-03-15_14-30-00_caph_q12.wpilog`
const advantageKitPattern = /^akit_(\d{2})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(_.*)?\.wpilog$/u;
const advantageKitMatchPattern = /_[pqe][1-9]\d*$/u;
const matchTypes: Record<string, MatchType> = { P: 'practice', Q: 'qualification', E: 'elimination' };

/**
 * Read the date and match from a log's file name, using WPILib's and AdvantageKit's naming.
 * Returns `undefined` for other names, including logs that haven't been dated yet (`FRC_TBD_*` or `akit_<random>`),
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
	const [month, day] = [part(2), part(3)];
	// Both name logs with the robot's clock, which is UTC on a roboRIO
	const date = new Date(Date.UTC((wpilib ? 0 : 2000) + part(1), month - 1, day, part(4), part(5), part(6)));
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
		// Not a real date, ex. February 30th
		return undefined;
	}

	const suffix = match[7] ?? '';
	if (!(wpilib ? wpilibMatchPattern : advantageKitMatchPattern).test(suffix)) {
		return { date, match: undefined };
	}
	// Ex. `_CAPH_Q12`, `_caph_q12`, or `__Q68` without an event name
	const parts = suffix.split('_').filter(Boolean);
	const label = parts.join(' ').toUpperCase();
	// The last part is the match, ex. `Q12`
	return { date, match: { label, type: matchTypes[parts.at(-1)![0]!.toUpperCase()]! } };
}
