import { Link } from '@tanstack/react-router';
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
import { type ReactNode, useState } from 'react';
import { TextMorph } from 'torph/react';
import type { BoardLog } from '@/sync/sync-board';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatSize, logLabel } from '@/sync/format';
import { type SyncStatus, syncNow } from '@/sync/sync';
import { updateSyncSettings } from '@/sync/sync-settings';

const minutesFormat = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'minute', unitDisplay: 'long' });

const steps = ['Connect to the robot', 'Copy new logs', 'Up to date'];
/** How long the timeline takes to fill in or empty each step */
const stepMs = 250;

type Tone = 'active' | 'success' | 'warning' | 'error' | 'idle';

const toneIcon: Record<Tone, string> = {
	active: 'bg-primary text-primary-foreground',
	success: 'bg-success/10 text-success-foreground',
	warning: 'bg-warning/10 text-warning-foreground',
	error: 'bg-destructive/10 text-destructive-foreground',
	idle: 'bg-muted text-muted-foreground',
};

const toneLine: Record<Tone, string> = {
	active: 'bg-primary',
	success: 'bg-success',
	warning: 'bg-warning',
	error: 'bg-destructive',
	idle: 'bg-muted-foreground',
};

const toneRing: Record<Tone, string> = {
	active: 'ring-primary/16',
	success: 'ring-success/16',
	warning: 'ring-warning/16',
	error: 'ring-destructive/16',
	idle: 'ring-muted-foreground/16',
};

interface StatusView {
	icon: LucideIcon;
	spin?: boolean;
	tone: Tone;
	/** Index in `steps` sync is on */
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
				action: (
					<Button variant="outline" render={<Link to="/settings" />}>
						Open Settings
					</Button>
				),
			};
		case 'other-window':
			return {
				icon: AppWindowIcon,
				tone: 'idle',
				step: stoppedStep,
				title: 'Syncing in another window',
				detail: 'Only one Studio window syncs logs at a time',
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
						{status.error !== undefined && <span className="block text-xs">{status.error}</span>}
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
				action: (
					<Button variant="outline" onClick={syncNow}>
						<RefreshCwIcon />
						Sync now
					</Button>
				),
			};
		default:
			return {
				icon: TriangleAlertIcon,
				tone: 'error',
				step: 1,
				title: 'Couldn’t sync logs',
				detail: status.message,
				action: (
					<Button variant="outline" onClick={syncNow}>
						<RefreshCwIcon />
						Try again
					</Button>
				),
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
	// The step sync was on before, so the timeline fills in or empties one step at a time from there
	const [moved, setMoved] = useState({ from: step, to: step });
	if (moved.to !== step) {
		setMoved({ from: moved.to, to: step });
	}
	const { from } = moved;
	const ToggleIcon = enabled ? PauseIcon : PlayIcon;
	const toggleLabel = enabled ? 'Pause sync' : 'Resume sync';
	const advancing = step > from;
	/** Whether moving from `from` to `step` fills in or empties step `index` */
	const changes = (index: number) => index > Math.min(from, step) && index <= Math.max(from, step);
	/** When the line into step `index` starts changing, after the lines before it when filling in or after it when emptying */
	const lineDelay = (index: number) => (changes(index) ? (advancing ? index - from - 1 : from - index) * stepMs : 0);
	/** When step `index`'s circle changes: once the line reaches it when filling in, before the line empties otherwise */
	const circleDelay = (index: number) => lineDelay(index) + (changes(index) && advancing ? stepMs : 0);

	// Top padding keeps the button's hover scale and focus outline clear of the sticky page header
	return (
		<section className="flex flex-col items-center gap-10 pt-2 text-center">
			<div className="flex flex-col items-center gap-4">
				<Tooltip>
					<TooltipTrigger
						render={
							<button
								type="button"
								aria-label={toggleLabel}
								onClick={() => updateSyncSettings({ enabled: !enabled })}
								className={cn(
									'group flex size-20 cursor-pointer items-center justify-center rounded-full outline-offset-4 transition-[background-color,color,scale] duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-ring active:scale-95 motion-reduce:transition-none',
									toneIcon[tone],
								)}
							/>
						}
					>
						<Icon
							className={cn(
								'size-9 group-hover:hidden group-focus-visible:hidden',
								view.spin === true && 'animate-spin [animation-duration:3s] motion-reduce:[animation-duration:8s]',
							)}
						/>
						<ToggleIcon className="hidden size-9 group-hover:block group-focus-visible:block" />
					</TooltipTrigger>
					<TooltipPopup>{toggleLabel}</TooltipPopup>
				</Tooltip>
				<div className="flex flex-col gap-1">
					<h2 className="font-heading text-2xl font-semibold">{view.title}</h2>
					<p className="text-sm text-muted-foreground tabular-nums">{view.detail}</p>
				</div>
				{view.action}
			</div>

			<ol className="flex w-full">
				{steps.map((label, index) => {
					const reached = index <= step;
					const current = index === step;
					return (
						<li
							key={label}
							aria-current={current ? 'step' : undefined}
							className="relative flex flex-1 flex-col items-center gap-3"
						>
							{index > 0 && (
								// The line from the previous step to this one, filling in from the left when sync gets here
								<span className="absolute top-2.5 right-1/2 h-1 w-full overflow-hidden bg-border">
									<span
										className={cn(
											'block size-full origin-left transition-[scale,background-color] ease-linear motion-reduce:transition-none',
											toneLine[tone],
											!reached && 'scale-x-0',
										)}
										// Color changes right away, filling waits for the steps before it
										style={{ transitionDuration: `${stepMs}ms`, transitionDelay: `${lineDelay(index)}ms, 0ms` }}
									/>
								</span>
							)}
							{current && view.spin === true && (
								<span
									className={cn(
										'absolute top-0 size-6 rounded-full opacity-40 motion-safe:animate-ping',
										toneLine[tone],
									)}
								/>
							)}
							<span
								className={cn(
									// Above the line to the next step
									'relative z-10 size-6 rounded-full border-4 transition-[background-color,border-color,box-shadow] motion-reduce:transition-none',
									reached ? cn('border-transparent', toneLine[tone]) : 'border-border bg-background',
									current && cn('ring-[6px]', toneRing[tone]),
								)}
								style={{ transitionDuration: `${stepMs}ms`, transitionDelay: `${circleDelay(index)}ms` }}
							/>
							<span className={cn('text-sm', current ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
