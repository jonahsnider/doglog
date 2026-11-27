import {
	borderVars,
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	shadowVars,
	spacingVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { PaneRect } from '@/panes/pane-highlights';

const styles = stylex.create({
	// Below the shown pane's header, letting taps through to the pane
	minimap: {
		position: 'absolute',
		top: `calc(36px + ${spacingVars['--spacing-1-5']})`,
		right: spacingVars['--spacing-1-5'],
		padding: spacingVars['--spacing-1'],
		borderWidth: borderVars['--border-width'],
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-popover'],
		boxShadow: shadowVars['--shadow-med'],
		opacity: 0,
		pointerEvents: 'none',
		transitionProperty: 'opacity',
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	shown: { opacity: 1 },
	frame: { position: 'relative', width: 96, aspectRatio: '16 / 10' },
	// The transparent border makes the gaps between panes
	pane: {
		position: 'absolute',
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: 'transparent',
		borderRadius: 3,
		backgroundClip: 'padding-box',
		backgroundColor: colorVars['--color-overlay-pressed'],
	},
	at: (x: number, y: number, width: number, height: number) => ({
		left: `${x * 100}%`,
		top: `${y * 100}%`,
		width: `${width * 100}%`,
		height: `${height * 100}%`,
	}),
	highlight: { backgroundColor: colorVars['--color-accent'] },
});

/** A miniature of the layout in the phone layout's corner, its highlight placed by `placeMinimapHighlight()` */
export function PaneMinimap({ rects, shown }: { rects: readonly PaneRect[]; shown: boolean }) {
	return (
		<div aria-hidden {...stylex.props(styles.minimap, shown && styles.shown)}>
			<div {...stylex.props(styles.frame)}>
				{rects.map((rect) => (
					<div key={rect.paneId} {...stylex.props(styles.pane, styles.at(rect.x, rect.y, rect.width, rect.height))} />
				))}
				<div data-minimap-highlight {...stylex.props(styles.pane, styles.highlight)} />
			</div>
		</div>
	);
}
