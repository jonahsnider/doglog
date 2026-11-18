import { DatabaseIcon, FileIcon, RadioTowerIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { Source } from '@/data/source';
import { liveColors } from '@/sidebar/source-labels';

/** A file for logs, and the connection's state for the live session */
export function SourceIcon({ source }: { source: Source | undefined }) {
	if (source?.status === 'loading' || source?.status === 'connecting') {
		return <Spinner />;
	}

	if (source === undefined) {
		return <DatabaseIcon />;
	}
	if (source.type === 'log') {
		return <FileIcon />;
	}
	return <RadioTowerIcon className={liveColors[source.status].text} />;
}
