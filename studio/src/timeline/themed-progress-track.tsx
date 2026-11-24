import { ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useSettings } from '@/settings';
import Monte from '@/theme/monte.svg?react';

export function ThemedProgressTrack({ className }: { className?: string }) {
	const { themePreset } = useSettings();
	if (themePreset !== 'match13') {
		return (
			<ProgressTrack className={className}>
				<ProgressIndicator />
			</ProgressTrack>
		);
	}

	return (
		<ProgressTrack
			className={cn('@container translate-y-2 overflow-visible [clip-path:inset(-1.5rem_0_0)]', className)}
		>
			<ProgressIndicator className="relative h-full rounded-full transition-none motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-linear">
				{/* Ride the fill's leading edge, but stay clear of the labels at either end of the track. */}
				<Monte
					aria-hidden="true"
					className="pointer-events-none absolute start-[clamp(0px,calc(100%-0.75rem),calc(100cqi-1.5rem))] bottom-0 size-6 text-primary motion-reduce:in-data-indeterminate:hidden"
				/>
			</ProgressIndicator>
		</ProgressTrack>
	);
}
