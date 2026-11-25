import {
	colorVars,
	easeVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';

const steps = ['Connect to the robot', 'Copy new logs', 'Up to date'];
/** How long the timeline takes to fill in or empty each step */
const stepMs = 250;

const ping = stylex.keyframes({ '75%, 100%': { transform: 'scale(2)', opacity: 0 } });

const styles = stylex.create({
	steps: {
		display: 'flex',
		width: '100%',
		margin: 0,
		padding: 0,
		listStyle: 'none',
	},
	step: {
		position: 'relative',
		display: 'flex',
		flex: 1,
		flexDirection: 'column',
		alignItems: 'center',
		gap: spacingVars['--spacing-3'],
	},
	track: {
		position: 'absolute',
		top: 10,
		right: '50%',
		width: '100%',
		height: 4,
		overflow: 'hidden',
		backgroundColor: colorVars['--color-border'],
	},
	line: {
		display: 'block',
		width: '100%',
		height: '100%',
		transformOrigin: 'left',
		transitionProperty: 'scale, background-color',
		transitionTimingFunction: 'linear',
	},
	unreached: { scale: '0 1' },
	// Color changes right away, filling waits for the steps before it
	lineTiming: (delay: number) => ({
		transitionDuration: `calc(${stepMs}ms * var(--motion-scale))`,
		transitionDelay: `calc(${delay}ms * var(--motion-scale)), 0ms`,
	}),
	fill: (color: string) => ({ backgroundColor: color }),
	ping: {
		position: 'absolute',
		top: 0,
		width: 24,
		height: 24,
		borderRadius: radiusVars['--radius-full'],
		opacity: 0.4,
		animationName: ping,
		animationDuration: 'calc(1s * var(--motion-scale))',
		animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
		animationIterationCount: 'infinite',
	},
	// Above the line to the next step
	circle: {
		position: 'relative',
		zIndex: 10,
		width: 24,
		height: 24,
		borderRadius: radiusVars['--radius-full'],
		borderWidth: 4,
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		backgroundColor: colorVars['--color-background-surface'],
		transitionProperty: 'background-color, border-color, box-shadow',
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	reached: (color: string) => ({ borderColor: 'transparent', backgroundColor: color }),
	current: (color: string) => ({ boxShadow: `0 0 0 6px ${color}` }),
	circleTiming: (delay: number) => ({
		transitionDuration: `calc(${stepMs}ms * var(--motion-scale))`,
		transitionDelay: `calc(${delay}ms * var(--motion-scale))`,
	}),
	label: {
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		color: colorVars['--color-text-secondary'],
	},
	currentLabel: {
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: colorVars['--color-text-primary'],
	},
});

/**
 * The steps of a sync, filled in up to the one sync is on in `color`. The step it's on pings while `active`. It fills in
 * or empties one step at a time from the step it was on before.
 */
export function SyncTimeline({ step, color, active }: { step: number; color: string; active: boolean }) {
	// The step sync was on before, so the timeline fills in or empties one step at a time from there
	const [moved, setMoved] = useState({ from: step, to: step });
	if (moved.to !== step) {
		setMoved({ from: moved.to, to: step });
	}
	const { from } = moved;
	const advancing = step > from;
	/** Whether moving from `from` to `step` fills in or empties step `index` */
	const changes = (index: number) => index > Math.min(from, step) && index <= Math.max(from, step);
	/** When the line into step `index` starts changing, after the lines before it when filling in or after it when emptying */
	const lineDelay = (index: number) => (changes(index) ? (advancing ? index - from - 1 : from - index) * stepMs : 0);
	/** When step `index`'s circle changes: once the line reaches it when filling in, before the line empties otherwise */
	const circleDelay = (index: number) => lineDelay(index) + (changes(index) && advancing ? stepMs : 0);

	return (
		<ol {...stylex.props(styles.steps)}>
			{steps.map((label, index) => {
				const reached = index <= step;
				const current = index === step;
				return (
					<li key={label} aria-current={current ? 'step' : undefined} {...stylex.props(styles.step)}>
						{index > 0 && (
							// The line from the previous step to this one, filling in from the left when sync gets here
							<span {...stylex.props(styles.track)}>
								<span
									{...stylex.props(
										styles.line,
										styles.fill(color),
										!reached && styles.unreached,
										styles.lineTiming(lineDelay(index)),
									)}
								/>
							</span>
						)}
						{current && active && <span {...stylex.props(styles.ping, styles.fill(color))} />}
						<span
							{...stylex.props(
								styles.circle,
								reached && styles.reached(color),
								current && styles.current(`color-mix(in srgb, ${color} 16%, transparent)`),
								styles.circleTiming(circleDelay(index)),
							)}
						/>
						<span {...stylex.props(styles.label, current && styles.currentLabel)}>{label}</span>
					</li>
				);
			})}
		</ol>
	);
}
