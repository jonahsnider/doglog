import { Button } from '@astryxdesign/core/Button';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useIsPresent } from 'motion/react';
import { closeLog, useLogProgress } from '@/data/source';
import { useCaptureFrame } from '@/desktop/capture';
import { ThemedProgressBar } from '@/timeline/themed-progress-bar';
import './fade-in.css';

const styles = stylex.create({
	footer: {
		display: 'flex',
		alignItems: 'center',
		height: '3.5rem',
		contain: 'strict',
	},
	content: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-3'],
		width: '100%',
		paddingInline: spacingVars['--spacing-4'],
	},
});

export function LogProgress({ id, fileName, cancelable }: { id: string; fileName: string; cancelable?: boolean }) {
	const present = useIsPresent();
	const progress = useLogProgress();
	const capture = useCaptureFrame();
	return (
		<footer aria-label="Timeline" inert={!present} {...stylex.props(styles.footer)} style={capture?.timelinePadding}>
			<div data-fade-in="delayed" {...stylex.props(styles.content)}>
				<ThemedProgressBar label={`Loading ${fileName}`} value={progress} />
				{cancelable === true && <Button label="Cancel" variant="ghost" size="sm" onClick={() => closeLog(id)} />}
			</div>
		</footer>
	);
}
