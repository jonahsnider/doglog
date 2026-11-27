import { useSelector } from '@tanstack/react-store';
import type { Atom } from '@tanstack/store';
import { TextMorph } from '@/components/text-morph';

/**
 * Keeps the status label mounted across toast updates. An undefined title follows download progress without replacing
 * the toast or announcing each percent in its live region.
 */
export function UpdateToastTitle({ title, percent }: { title: string | undefined; percent: Atom<number | undefined> }) {
	const value = useSelector(percent, (progress) => (title === undefined ? progress : undefined));
	return (
		<>
			<TextMorph numbers={false} style={{ maxWidth: '100%', verticalAlign: 'bottom', whiteSpace: 'normal' }}>
				{title ?? (value === undefined ? 'Downloading update…' : 'Downloading update')}
			</TextMorph>
			{value !== undefined && (
				<>
					{' '}
					<span aria-live="off">
						<TextMorph as="span">{`${value}%`}</TextMorph>
					</span>
				</>
			)}
		</>
	);
}
