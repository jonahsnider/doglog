import { Heading } from '@astryxdesign/core/Text';
import {
	colorVars,
	durationVars,
	easeVars,
	focusVars,
	radiusVars,
	spacingVars,
	textSizeVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useHotkeys } from '@tanstack/react-hotkeys';
import { InlineShortcut } from '@/components/shortcut';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import type { WidgetType } from '@/widgets/widget-type';

// Short panes list the widgets as rows, and tiny ones also drop the title
const compact = '@container add-widget ((height < 23rem) or (width < 18rem))';
const tiny = '@container add-widget (height < 11rem)';

const styles = stylex.create({
	prompt: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'safe center',
		gap: spacingVars['--spacing-4'],
		height: '100%',
		overflow: 'auto',
		padding: spacingVars['--spacing-4'],
		containerType: 'size',
		containerName: 'add-widget',
	},
	title: {
		display: { default: null, [tiny]: 'none' },
	},
	grid: {
		display: 'grid',
		width: '100%',
		maxWidth: { default: '24rem', [compact]: '14rem' },
		gridTemplateColumns: { default: 'repeat(2, minmax(0, 1fr))', [compact]: 'minmax(0, 1fr)' },
		gap: { default: spacingVars['--spacing-3'], [compact]: spacingVars['--spacing-2'] },
	},
	tile: {
		display: 'flex',
		flexDirection: { default: 'column', [compact]: 'row' },
		alignItems: { default: 'stretch', [compact]: 'center' },
		gap: spacingVars['--spacing-2'],
		padding: spacingVars['--spacing-2'],
		paddingInline: { default: spacingVars['--spacing-2'], [compact]: spacingVars['--spacing-3'] },
		cursor: 'pointer',
		color: {
			default: colorVars['--color-text-secondary'],
			':hover': { default: null, '@media (hover: hover)': colorVars['--color-text-primary'] },
		},
		fontSize: textSizeVars['--font-size-base'],
		textAlign: 'start',
		backgroundColor: colorVars['--color-background-card'],
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: {
			default: colorVars['--color-border'],
			':hover': { default: null, '@media (hover: hover)': colorVars['--color-border-emphasized'] },
		},
		borderRadius: radiusVars['--radius-container'],
		outlineWidth: { default: 0, ':focus-visible': focusVars['--focus-outline-width'] },
		outlineStyle: focusVars['--focus-outline-style'],
		outlineColor: focusVars['--focus-outline-color'],
		outlineOffset: focusVars['--focus-outline-offset'],
		transitionProperty: 'border-color, color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	preview: {
		display: { default: 'flex', [compact]: 'contents' },
		alignItems: 'center',
		justifyContent: 'center',
		aspectRatio: '16 / 10',
		backgroundColor: colorVars['--color-background-muted'],
		borderRadius: radiusVars['--radius-element'],
	},
	icon: {
		flexShrink: 0,
		width: { default: spacingVars['--spacing-8'], [compact]: spacingVars['--spacing-4'] },
		height: { default: spacingVars['--spacing-8'], [compact]: spacingVars['--spacing-4'] },
	},
	label: {
		display: 'flex',
		flex: { default: null, [compact]: 1 },
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacingVars['--spacing-2'],
		paddingInline: { default: spacingVars['--spacing-1'], [compact]: 0 },
	},
});

/** Shown in empty panes, its hotkeys only work while the pane is focused */
export function AddWidgetPrompt({ onAdd, focused }: { onAdd: (type: WidgetType) => void; focused: boolean }) {
	useHotkeys(
		widgetTypes.flatMap((type) => (type.hotkey ? [{ hotkey: type.hotkey, callback: () => onAdd(type) }] : [])),
		{ enabled: focused },
	);

	return (
		<div
			{...stylex.props(styles.prompt)}
			onDoubleClick={(event) => {
				// Double-clicking a widget tile shouldn't also add the default widget
				if (!(event.target instanceof Element && event.target.closest('button'))) {
					onAdd(getWidgetType('graph')!);
				}
			}}
		>
			<div {...stylex.props(styles.title)}>
				<Heading level={2}>Add widget</Heading>
			</div>
			<div {...stylex.props(styles.grid)}>
				{widgetTypes.map((type) => (
					<button
						key={type.id}
						type="button"
						aria-label={type.name}
						{...stylex.props(styles.tile)}
						onClick={() => onAdd(type)}
					>
						<span {...stylex.props(styles.preview)}>
							<type.icon {...stylex.props(styles.icon)} />
						</span>
						<span {...stylex.props(styles.label)}>
							<span>{type.name}</span>
							{type.hotkey && <InlineShortcut hotkey={type.hotkey} />}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
