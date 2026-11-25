import { Button } from '@astryxdesign/core/Button';
import { useIsPresent } from 'motion/react';
import { closeLog, useLogProgress } from '@/data/source';
import { useCaptureFrame } from '@/desktop/capture';
import { ThemedProgressBar } from '@/timeline/themed-progress-bar';

export function LogProgress({ fileName, cancelable }: { fileName: string; cancelable?: boolean }) {
	const present = useIsPresent();
	const progress = useLogProgress();
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
				<ThemedProgressBar label={`Loading ${fileName}`} value={progress} />
				{cancelable === true && <Button label="Cancel" variant="ghost" size="sm" onClick={closeLog} />}
			</div>
		</footer>
	);
}
