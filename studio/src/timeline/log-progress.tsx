import { useIsPresent } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from '@/components/ui/progress';
import { closeLog, useLogProgress } from '@/data/source';
import { useCaptureFrame } from '@/desktop/capture';

export function LogProgress({ fileName, cancelable }: { fileName: string; cancelable?: boolean }) {
	const present = useIsPresent();
	const progress = useLogProgress();
	const indeterminate = progress === undefined;
	const capture = useCaptureFrame();
	return (
		<footer
			aria-label="Timeline"
			inert={!present}
			className="flex h-14 items-center contain-strict"
			style={capture?.timelinePadding}
		>
			{/* Fades in after a moment so small logs that load instantly don't flash it */}
			<div className="flex w-full items-center gap-3 px-4 transition-opacity delay-200 duration-300 starting:opacity-0">
				<Progress value={indeterminate ? null : progress * 100} className="flex-1 flex-row items-center gap-3">
					<ProgressLabel className="max-w-1/3 truncate font-normal text-muted-foreground">
						Loading {fileName}
					</ProgressLabel>
					<ProgressTrack className="h-1 flex-1">
						<ProgressIndicator />
					</ProgressTrack>
					{!indeterminate && <ProgressValue className="min-w-10 text-right font-mono text-muted-foreground" />}
				</Progress>
				{cancelable === true && (
					<Button variant="ghost" size="sm" onClick={closeLog}>
						Cancel
					</Button>
				)}
			</div>
		</footer>
	);
}
