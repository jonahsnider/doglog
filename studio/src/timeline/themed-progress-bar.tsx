import { HStack } from '@astryxdesign/core/Layout';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Text } from '@astryxdesign/core/Text';
import { TextMorph } from '@/components/text-morph';
import { useSettings } from '@/settings';
import './themed-progress-bar.css';

/**
 * A progress bar with its label and percentage on the same row, so it fits in the timeline bar and Monte has room to
 * ride it on the match13 preset. `value` is from 0 to 1, `undefined` while it's unknown.
 */
export function ThemedProgressBar({ label, value }: { label: string; value: number | undefined }) {
	const { themePreset } = useSettings();
	return (
		<HStack gap={3} vAlign="center" className="themed-progress-bar">
			<Text type="supporting" color="secondary" maxLines={1} className="themed-progress-bar-label">
				{label}
			</Text>
			<div className="themed-progress-bar-track" data-mascot={themePreset === 'match13' || undefined}>
				<ProgressBar
					label={label}
					isLabelHidden
					value={value === undefined ? 0 : value * 100}
					isIndeterminate={value === undefined}
				/>
			</div>
			{value !== undefined && (
				<Text type="code" color="secondary" className="themed-progress-bar-value">
					<TextMorph>{`${Math.round(value * 100)}%`}</TextMorph>
				</Text>
			)}
		</HStack>
	);
}
