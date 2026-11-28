import { useClipboard } from '@astryxdesign/core/hooks';
import { IconButton } from '@astryxdesign/core/IconButton';
import { InputGroup } from '@astryxdesign/core/InputGroup';
import { TextInput } from '@astryxdesign/core/TextInput';
import { durationVars, easeVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import CheckIcon from 'lucide-react/icons/check';
import CopyIcon from 'lucide-react/icons/copy';
import { toastManager } from '@/components/toast';

const styles = stylex.create({
	// Stacks the copy and check icons, so they cross-fade
	icons: { display: 'grid', width: '100%', height: '100%' },
	icon: {
		gridArea: '1 / 1',
		width: '100%',
		height: '100%',
		transitionProperty: 'opacity, scale',
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	hidden: { opacity: 0, scale: 0.5 },
});

/** A value people copy, ex. a link, with a button that copies it */
export function CopyField({ label, value }: { label: string; value: string }) {
	const name = label.toLowerCase();
	const { copy, isCopied } = useClipboard({ announce: `Copied the ${name}` });

	async function copyValue() {
		if (!(await copy(value))) {
			toastManager.add({ type: 'error', title: `Couldn’t copy the ${name}` });
		}
	}

	return (
		<InputGroup label={label} isLabelHidden>
			<TextInput label={label} isReadOnly value={value} />
			<IconButton
				label={`Copy ${name}`}
				tooltip="Copy"
				icon={
					<span {...stylex.props(styles.icons)}>
						<CopyIcon {...stylex.props(styles.icon, isCopied && styles.hidden)} />
						<CheckIcon {...stylex.props(styles.icon, !isCopied && styles.hidden)} />
					</span>
				}
				onClick={() => void copyValue()}
			/>
		</InputGroup>
	);
}
