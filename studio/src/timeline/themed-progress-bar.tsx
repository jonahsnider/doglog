import { HStack } from '@astryxdesign/core/Layout';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Text } from '@astryxdesign/core/Text';
import * as stylex from '@stylexjs/stylex';
import { useSettings } from '@/settings';
import './themed-progress-bar.css';

const styles = stylex.create({
	bar: {
		flex: 1,
		minWidth: 0,
	},
	label: {
		maxWidth: '33%',
	},
	track: {
		flex: 1,
		minWidth: 0,
	},
	// Fits 100% without the row moving as the number changes
	value: {
		flexShrink: 0,
		width: '2.5rem',
		textAlign: 'end',
		fontVariantNumeric: 'tabular-nums',
	},
});

/**
 * A progress bar with its label and percentage on the same row, so it fits in the timeline bar and Monte has room to
 * ride it on the match13 preset. `value` is from 0 to 1, `undefined` while it's unknown.
 */
export function ThemedProgressBar({ label, value }: { label: string; value: number | undefined }) {
	const { themePreset } = useSettings();
	return (
		<HStack gap={3} vAlign="center" xstyle={styles.bar}>
			<Text type="supporting" color="secondary" maxLines={1} xstyle={styles.label}>
				{label}
			</Text>
			<div
				data-themed-progress
				data-progress-mascot={themePreset === 'match13' || undefined}
				{...stylex.props(styles.track)}
			>
				<ProgressBar
					label={label}
					isLabelHidden
					value={value === undefined ? 0 : value * 100}
					isIndeterminate={value === undefined}
				/>
			</div>
			{value !== undefined && (
				<Text type="code" color="secondary" xstyle={styles.value}>
					{Math.round(value * 100)}%
				</Text>
			)}
		</HStack>
	);
}
