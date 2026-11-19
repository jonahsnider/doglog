import { useIsPresent } from 'motion/react';
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from '@/components/ui/progress';
import { useLogProgress } from '@/data/source';

export function LogProgress({ fileName }: { fileName: string }) {
	const present = useIsPresent();
	const progress = useLogProgress();
	return (
		<footer
			aria-label="Timeline"
			inert={!present}
			className="flex h-14 items-center rounded-t-lg bg-background px-4 contain-strict"
		>
			{/* Fades in after a moment so small logs that load instantly don't flash it */}
			<Progress
				value={progress * 100}
				className="flex-row items-center gap-3 transition-opacity delay-200 duration-300 starting:opacity-0"
			>
				<ProgressLabel className="max-w-1/3 truncate font-normal text-muted-foreground">
					Loading {fileName}
				</ProgressLabel>
				<ProgressTrack className="h-1 flex-1">
					<ProgressIndicator />
				</ProgressTrack>
				<ProgressValue className="min-w-10 text-right font-mono text-muted-foreground" />
			</Progress>
		</footer>
	);
}
