// oxlint-disable max-lines -- The sync status's states, toggle, and their styles are kept together
import { Button } from '@astryxdesign/core/Button';
import {
	colorVars,
	durationVars,
	easeVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	textSizeVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { focusOutlineProps } from '@astryxdesign/core/utils/focusOutline.stylex';
import * as stylex from '@stylexjs/stylex';
import AppWindowIcon from 'lucide-react/icons/app-window';
import CheckIcon from 'lucide-react/icons/check';
import HourglassIcon from 'lucide-react/icons/hourglass';
import LoaderCircleIcon from 'lucide-react/icons/loader-circle';
import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import RefreshCwIcon from 'lucide-react/icons/refresh-cw';
import SettingsIcon from 'lucide-react/icons/settings';
import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import type { LucideIcon } from 'lucide-react/types';
import type { ReactNode } from 'react';
import { TextMorph } from '@/components/text-morph';
import type { BoardLog } from '@/sync/sync-board';
import { formatSize, logLabel } from '@/sync/format';
import { syncToggleMarker } from './markers.stylex';
import { SyncTimeline } from '@/sync/sync-timeline';
import { type SyncStatus, syncNow } from '@/sync/sync';
import { updateSyncSettings } from '@/sync/sync-settings';
import './sync-status.css';

const minutesFormat = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'minute', unitDisplay: 'long' });

type Tone = 'active' | 'success' | 'warning' | 'error' | 'idle';

const toneColors: Record<Tone, string> = {
	active: colorVars['--color-accent'],
	success: colorVars['--color-success'],
	warning: colorVars['--color-warning'],
	error: colorVars['--color-error'],
	idle: colorVars['--color-text-secondary'],
};

const spin = stylex.keyframes({ to: { transform: 'rotate(360deg)' } });

const styles = stylex.create({
	section: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		gap: spacingVars['--spacing-10'],
		paddingTop: spacingVars['--spacing-2'],
		textAlign: 'center',
	},
	summary: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		gap: spacingVars['--spacing-4'],
		maxWidth: '100%',
	},
	toggle: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: 80,
		height: 80,
		padding: 0,
		borderStyle: 'none',
		borderRadius: radiusVars['--radius-full'],
		cursor: 'pointer',
		outlineOffset: 4,
		scale: { default: null, ':hover': 1.05, ':active': 0.95 },
		transitionProperty: 'background-color, color, scale',
		transitionDuration: `calc(${durationVars['--duration-fast-max']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	icon: { width: 36, height: 36 },
	// The status's icon makes way for the toggle's while the button is hovered or focused
	statusIcon: {
		display: {
			default: null,
			[stylex.when.ancestor(':hover', syncToggleMarker)]: 'none',
			[stylex.when.ancestor(':focus-visible', syncToggleMarker)]: 'none',
		},
	},
	toggleIcon: {
		display: {
			default: 'none',
			[stylex.when.ancestor(':hover', syncToggleMarker)]: 'block',
			[stylex.when.ancestor(':focus-visible', syncToggleMarker)]: 'block',
		},
	},
	// Slows down instead of stopping when reducing motion, so it still shows that sync is working
	spinning: {
		animationName: spin,
		animationDuration: 'calc(8s - 5s * var(--motion-scale))',
		animationTimingFunction: 'linear',
		animationIterationCount: 'infinite',
	},
	text: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-1'],
		maxWidth: '100%',
	},
	title: {
		margin: 0,
		fontFamily: typographyVars['--font-family-heading'],
		fontSize: textSizeVars['--font-size-2xl'],
		lineHeight: '2rem',
		fontWeight: fontWeightVars['--font-weight-semibold'],
	},
	detail: {
		margin: 0,
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		color: colorVars['--color-text-secondary'],
		fontVariantNumeric: 'tabular-nums',
	},
	error: { display: 'block', fontSize: typeScaleVars['--text-supporting-size'], lineHeight: '1rem' },
});

// The status icon's background and color
const toneStyles = stylex.create({
	active: { backgroundColor: colorVars['--color-accent'], color: colorVars['--color-on-accent'] },
	success: {
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-success']} 10%, transparent)`,
		color: colorVars['--color-text-success'],
	},
	warning: {
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-warning']} 10%, transparent)`,
		color: colorVars['--color-text-warning'],
	},
	error: {
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-error']} 10%, transparent)`,
		color: colorVars['--color-text-error'],
	},
	idle: { backgroundColor: colorVars['--color-background-muted'], color: colorVars['--color-icon-secondary'] },
});

interface StatusView {
	icon: LucideIcon;
	spin?: boolean;
	tone: Tone;
	/** The step of `SyncTimeline` sync is on */
	step: number;
	title: string;
	detail: ReactNode;
	action?: ReactNode;
}

function count(n: number, noun: string): string {
	return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function timeLeft(seconds: number): string {
	return seconds < 60 ? 'less than a minute left' : `about ${minutesFormat.format(Math.round(seconds / 60))} left`;
}

/**
 * @param stoppedStep Step sync stopped on when it's not running: copying while logs are waiting, otherwise up to date
 */
function viewFor(status: SyncStatus, syncedCount: number, days: number, stoppedStep: number): StatusView {
	switch (status.type) {
		case 'paused':
			return {
				icon: PauseIcon,
				tone: 'warning',
				step: stoppedStep,
				title: 'Sync is paused',
				detail: 'Logs on the robot aren’t copied until you resume',
			};
		case 'no-robot':
			return {
				icon: SettingsIcon,
				tone: 'warning',
				step: 0,
				title: 'Set your team number to sync logs',
				detail: 'Sync uses the same robot as Connect',
				action: <Button label="Open Settings" href="/settings" />,
			};
		case 'other-app':
			return {
				icon: AppWindowIcon,
				tone: 'idle',
				step: stoppedStep,
				title: 'Syncing in another copy of Studio',
				detail: 'Only one copy of Studio syncs logs at a time',
			};
		case 'waiting':
			return {
				icon: LoaderCircleIcon,
				spin: true,
				tone: 'idle',
				step: 0,
				title: 'Looking for the robot',
				detail: (
					<>
						Trying {status.host}
						{status.error !== undefined && <span {...stylex.props(styles.error)}>{status.error}</span>}
					</>
				),
			};
		case 'robot-enabled':
			return {
				icon: HourglassIcon,
				tone: 'warning',
				step: 1,
				title: 'Waiting while the robot is enabled',
				detail: 'Sync continues once the robot has been disabled for 10 seconds',
			};
		case 'syncing':
			return {
				icon: RefreshCwIcon,
				spin: true,
				tone: 'active',
				step: 1,
				title: `Copying ${logLabel(status.file)}`,
				detail: (
					<>
						<TextMorph as="span">{`Log ${status.fileNumber} of ${status.fileCount}`}</TextMorph>,{' '}
						<TextMorph as="span">{formatSize(status.copied)}</TextMorph> of{' '}
						<TextMorph as="span">{formatSize(status.total)}</TextMorph>
						{status.secondsLeft !== undefined && `, ${timeLeft(status.secondsLeft)}`}
					</>
				),
			};
		case 'up-to-date':
			return {
				icon: CheckIcon,
				tone: 'success',
				step: 2,
				title: 'Up to date',
				detail: `${count(syncedCount, 'log')} from the last ${count(days, 'day')}`,
				action: <Button label="Sync now" icon={<RefreshCwIcon />} onClick={syncNow} />,
			};
		default:
			return {
				icon: TriangleAlertIcon,
				tone: 'error',
				step: 1,
				title: 'Couldn’t sync logs',
				detail: status.message,
				action: <Button label="Try again" icon={<RefreshCwIcon />} onClick={syncNow} />,
			};
	}
}

/** What sync is doing, as a big icon over a timeline of the steps of a sync, with the buttons to control it */
export function SyncStatusPanel({
	status,
	enabled,
	boardLogs,
	days,
}: {
	status: SyncStatus;
	enabled: boolean;
	boardLogs: BoardLog[];
	days: number;
}) {
	const syncedCount = boardLogs.filter((log) => log.state === 'synced').length;
	const waiting = boardLogs.some((log) => log.state === 'queued' || log.state === 'copying');
	const view = viewFor(status, syncedCount, days, waiting || syncedCount === 0 ? 1 : 2);
	const { icon: Icon, tone, step } = view;
	const ToggleIcon = enabled ? PauseIcon : PlayIcon;
	const toggleLabel = enabled ? 'Pause sync' : 'Resume sync';

	// Top padding keeps the button's hover scale and focus outline clear of the sticky page header
	return (
		<section {...stylex.props(styles.section)}>
			<div {...stylex.props(styles.summary)}>
				<Tooltip content={toggleLabel}>
					<button
						type="button"
						aria-label={toggleLabel}
						onClick={() => updateSyncSettings({ enabled: !enabled })}
						{...focusOutlineProps.focusVisible(syncToggleMarker, styles.toggle, toneStyles[tone])}
					>
						<Icon {...stylex.props(styles.icon, styles.statusIcon, view.spin === true && styles.spinning)} />
						<ToggleIcon {...stylex.props(styles.icon, styles.toggleIcon)} />
					</button>
				</Tooltip>
				<div {...stylex.props(styles.text)}>
					<h2 {...stylex.props(styles.title)}>
						<TextMorph data-sync-title numbers={false}>
							{view.title}
						</TextMorph>
					</h2>
					<p {...stylex.props(styles.detail)}>{view.detail}</p>
				</div>
				{view.action}
			</div>

			<SyncTimeline step={step} color={toneColors[tone]} active={view.spin === true} />
		</section>
	);
}
