import DatabaseIcon from 'lucide-react/icons/database';
import FileIcon from 'lucide-react/icons/file';
import RadioTowerIcon from 'lucide-react/icons/radio-tower';
import { Spinner } from '@astryxdesign/core/Spinner';
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
	return <RadioTowerIcon color={liveColors[source.status]} />;
}
