import {
	colorVars,
	durationVars,
	easeVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { Shortcut } from '@/components/shortcut';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { View } from '@/widgets/view-toggle';

const styles = stylex.create({
	container: {
		pointerEvents: 'none',
		containerType: 'inline-size',
		display: 'flex',
		minHeight: 0,
		flex: 1,
		alignItems: 'flex-end',
		overflow: 'hidden',
	},
	panel: {
		display: { default: null, '@container (width < 9rem)': 'none' },
		maxWidth: '100%',
		borderRadius: radiusVars['--radius-element'],
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		backgroundColor: colorVars['--color-background-popover'],
		paddingInline: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-1'],
		color: colorVars['--color-text-primary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		transitionProperty: 'opacity',
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-entrance'],
	},
	hidden: {
		opacity: 0,
		transitionDuration: `calc(${durationVars['--duration-exit']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-exit'],
	},
	list: {
		display: 'grid',
		gridTemplateColumns: 'auto minmax(0, 1fr)',
		alignItems: 'baseline',
		columnGap: spacingVars['--spacing-2'],
		rowGap: spacingVars['--spacing-0-5'],
	},
	row: {
		gridColumn: 'span 2',
		display: 'grid',
		gridTemplateColumns: 'subgrid',
	},
	action: {
		fontWeight: fontWeightVars['--font-weight-medium'],
	},
});

const touchGestures = {
	'2d': [['Pan', 'Drag when zoomed']],
	'3d': [
		['Orbit', '1-finger drag'],
		['Pan', '2-finger drag'],
		['Zoom', 'Pinch'],
	],
} as const;

// Mouse and trackpad share these gestures, so there's no need for separate lists.
const pointerGestures = {
	'2d': [
		['Pan', 'Drag when zoomed'],
		['Zoom', 'Scroll'],
		['Reset', 'Double-click'],
	],
	'3d': [
		[
			'Orbit',
			<>
				Drag or <Shortcut hotkey="ArrowUp" /> <Shortcut hotkey="ArrowDown" /> <Shortcut hotkey="ArrowLeft" />{' '}
				<Shortcut hotkey="ArrowRight" />
			</>,
		],
		[
			'Pan',
			<>
				<Shortcut hotkey="Shift" /> + drag or <Shortcut hotkey="A" /> <Shortcut hotkey="D" /> <Shortcut hotkey="Q" />{' '}
				<Shortcut hotkey="E" />
			</>,
		],
		[
			'Zoom',
			<>
				Scroll or <Shortcut hotkey="W" /> <Shortcut hotkey="S" />
			</>,
		],
	],
} as const;

export function SceneControls({
	view,
	visible,
	disabled = false,
	xstyle,
}: {
	view: View;
	visible: boolean;
	disabled?: boolean;
	xstyle?: stylex.StyleXStyles;
}) {
	const touch = useMediaQuery('(pointer: coarse)');
	if (disabled) {
		return null;
	}
	const gestures = (touch ? touchGestures : pointerGestures)[view];
	const container = stylex.props(styles.container, xstyle);
	return (
		<div {...container} className={`${container.className} capture-hidden`} aria-hidden={!visible}>
			<div {...stylex.props(styles.panel, !visible && styles.hidden)}>
				<dl aria-label={`${view.toUpperCase()} view controls`} {...stylex.props(styles.list)}>
					{gestures.map(([action, input]) => (
						<div key={action} {...stylex.props(styles.row)}>
							<dt {...stylex.props(styles.action)}>{action}</dt>
							<dd>{input}</dd>
						</div>
					))}
				</dl>
			</div>
		</div>
	);
}
