import { useSelector } from '@tanstack/react-store';
import type { Atom } from '@tanstack/store';
import { TextMorph } from '@/components/text-morph';

/** Rerenders with the download's progress inside the update toast, rather than replacing the toast, which screen readers would announce each time */
export function DownloadingUpdate({ percent }: { percent: Atom<number | undefined> }) {
	const value = useSelector(percent);
	if (value === undefined) {
		return 'Downloading update…';
	}
	return (
		<>
			Downloading update <TextMorph as="span">{`${value}%`}</TextMorph>
		</>
	);
}
