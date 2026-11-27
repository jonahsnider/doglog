import { InputGroup, InputGroupText } from '@astryxdesign/core/InputGroup';
import { TextInput } from '@astryxdesign/core/TextInput';
import * as stylex from '@stylexjs/stylex';
import { detectPlatform } from '@tanstack/react-hotkeys';
import { isEnterKey } from '@/lib/keyboard';
import { consoleFilterInputs } from '@/widgets/console/filter-inputs';

const styles = stylex.create({
	filter: { minWidth: '14rem', flex: 1 },
	count: { fontVariantNumeric: 'tabular-nums' },
});

const findShortcut = detectPlatform() === 'mac' ? 'Meta+F' : 'Control+F';

export function ConsoleFilter({
	paneId,
	value,
	invalid,
	matchCount,
	onChange,
	onStep,
}: {
	paneId: string;
	value: string;
	invalid: boolean;
	matchCount: string | undefined;
	onChange: (value: string) => void;
	onStep: (direction: -1 | 1) => void;
}) {
	const filterRef = (input: HTMLInputElement | null) => {
		if (!input) {
			return undefined;
		}
		consoleFilterInputs.set((inputs) => new Map(inputs).set(paneId, input));
		return () => {
			const inputs = new Map(consoleFilterInputs.get());
			inputs.delete(paneId);
			consoleFilterInputs.set(inputs);
		};
	};

	return (
		<div {...stylex.props(styles.filter)}>
			<InputGroup label="Console" isLabelHidden size="sm">
				<TextInput
					ref={filterRef}
					type="search"
					label="Filter messages"
					isLabelHidden
					startIcon="search"
					placeholder="Filter messages"
					aria-keyshortcuts={findShortcut}
					// The message list says so too, so its message is only on the status icon
					status={invalid ? { type: 'error', message: 'Invalid regular expression' } : undefined}
					statusVariant="tooltip"
					value={value}
					onChange={onChange}
					onKeyDown={(event) => {
						if (isEnterKey(event)) {
							event.preventDefault();
							onStep(event.shiftKey ? -1 : 1);
						}
					}}
				/>
				{matchCount !== undefined && <InputGroupText xstyle={styles.count}>{matchCount}</InputGroupText>}
			</InputGroup>
		</div>
	);
}
