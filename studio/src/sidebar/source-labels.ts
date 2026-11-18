import { getLogEntry, type LiveSource, type Source } from '@/data/source';
import { parseLogName, readLogMatch } from '@/sync/log-names';

export const statusLabels: Record<Source['status'], string> = {
	loading: 'Loading…',
	loaded: 'Log file',
	connecting: 'Connecting…',
	connected: 'Connected',
	reconnecting: 'Reconnecting…',
	disconnected: 'Disconnected',
};

/**
 * The source's state, with the match a loaded log is from, ex. `Log file for CAPH Q12`.
 * The log's Driver Station data is preferred, since people often rename logs when sharing them.
 */
export function sourceStatus(source: Source): string {
	const match =
		source.status === 'loaded' && source.type === 'log'
			? (readLogMatch(getLogEntry) ?? parseLogName(source.fileName)?.match)
			: undefined;
	return match === undefined ? statusLabels[source.status] : `Log file for ${match.label}`;
}

/** A source's name, the log's file name or the live session's address */
export function sourceName(source: Source): string {
	return source.type === 'log' ? source.fileName : source.host;
}

export const liveColors: Record<LiveSource['status'], { text: string; background: string }> = {
	connecting: { text: 'text-muted-foreground', background: 'bg-muted-foreground' },
	connected: { text: 'text-success', background: 'bg-success' },
	reconnecting: { text: 'text-destructive-foreground', background: 'bg-destructive-foreground' },
	disconnected: { text: 'text-muted-foreground', background: 'bg-muted-foreground' },
};
