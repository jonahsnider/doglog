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
	return {
		name: label ?? date,
		detail: label === undefined ? statusLabels.loaded : date,
		matchType: match?.type,
	};
}

export const liveColors: Record<LiveSource['status'], { text: string; background: string }> = {
	connecting: { text: 'text-muted-foreground', background: 'bg-muted-foreground' },
	connected: { text: 'text-success', background: 'bg-success' },
	reconnecting: { text: 'text-destructive-foreground', background: 'bg-destructive-foreground' },
	disconnected: { text: 'text-muted-foreground', background: 'bg-muted-foreground' },
};
