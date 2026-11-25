import { getLogEntry, type LiveSource, type Source } from '@/data/source';
import { dateTimeFormat } from '@/sync/format';
import { parseLogName, readLogMatch } from '@/sync/log-names';

export const statusLabels: Record<Source['status'], string> = {
	loading: 'Loading…',
	loaded: 'Log file',
	connecting: 'Connecting…',
	connected: 'Connected',
	reconnecting: 'Reconnecting…',
	disconnected: 'Disconnected',
};

/** The two lines shown in the source control and switcher, plus the match type for a formatted log. */
export function sourceLabels(source: Source | undefined) {
	if (source === undefined) {
		return { name: 'No data source', detail: 'Open a log or connect' };
	}
	if (source.type === 'live') {
		return { name: source.host, detail: statusLabels[source.status] };
	}
	if (source.status === 'loading') {
		return { name: source.fileName, detail: statusLabels.loading };
	}

	const parsed = parseLogName(source.fileName);
	// Driver Station data takes precedence over the name, which may have been edited.
	const match = readLogMatch(getLogEntry) ?? parsed?.match;
	if (parsed === undefined) {
		return {
			name: source.fileName,
			detail: match === undefined ? statusLabels.loaded : `Log file for ${match.label}`,
		};
	}
	const date = dateTimeFormat.format(parsed.date);
	const label = match?.label ?? parsed.event;
	let detail = label === undefined ? statusLabels.loaded : date;
	if (parsed.canBus !== undefined) {
		// Ex. `roboRIO HOOT`, or `CANivore HOOT · Nov 8, 2026, 1:20 AM` for a match
		// The bus goes first since it's what tells a match's logs apart, and the date may not fit
		const hoot = `${parsed.canBus} HOOT`;
		detail = label === undefined ? hoot : `${hoot} · ${date}`;
	}
	return { name: label ?? date, detail, matchType: match?.type };
}

/** The live session's color for its state, for its icon and the dot on the log's */
export const liveColors: Record<LiveSource['status'], string> = {
	connecting: 'var(--color-icon-secondary)',
	connected: 'var(--color-icon-success)',
	reconnecting: 'var(--color-icon-error)',
	disconnected: 'var(--color-icon-secondary)',
};
