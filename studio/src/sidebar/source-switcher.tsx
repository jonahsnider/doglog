import { XIcon } from 'lucide-react';
import { useAnimate } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { MenuItem } from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { closeLive, closeLog, type Source, showSource } from '@/data/source';
import { easing, useMotionTransition } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { SourceIcon } from '@/sidebar/source-icon';
import { sourceName, sourceStatus } from '@/sidebar/source-labels';

/**
 * The raised surface behind the shown source. Switching sources slides it over the other source, its shadow deepening
 * while it moves as though it's lifted off them. Sources are the same height, so it moves by its own height.
 */
function ShownIndicator({ index }: { index: number }) {
	const [scope, animate] = useAnimate<HTMLDivElement>();
	const shadow = useRef<HTMLDivElement>(null);
	const transition = useMotionTransition({ duration: 0.25, ease: easing.inOut });
	const shownIndex = useRef(index);

	// Before painting, so it's under the shown source as soon as the menu opens
	useLayoutEffect(() => {
		void animate(scope.current, { y: `${shownIndex.current * 100}%` }, { duration: 0 });
	}, [animate, scope]);

	useLayoutEffect(() => {
		const from = shownIndex.current;
		if (from === index) {
			return;
		}
		shownIndex.current = index;
		void animate(scope.current, { y: [`${from * 100}%`, `${index * 100}%`] }, transition);
		if (shadow.current) {
			void animate(shadow.current, { opacity: [0, 1, 0] }, transition);
		}
	}, [animate, index, scope, transition]);

	return (
		<div
			ref={scope}
			aria-hidden
			className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-md bg-background shadow-sm/5 dark:bg-input"
		>
			<div ref={shadow} className="absolute inset-0 rounded-md opacity-0 shadow-lg/10" />
		</div>
	);
}

function SourceRow({ source, shown }: { source: Source; shown: boolean }) {
	const name = sourceName(source);
	const closeLabel = source.type === 'log' ? 'Close log' : 'Disconnect and clear live data';
	return (
		<div className="relative flex items-center">
			<MenuItem
				// Kept open so the switch can be seen
				closeOnClick={false}
				aria-current={shown}
				className={cn(
					'min-h-11! flex-1 gap-2.5 rounded-md bg-transparent py-1.5 pe-9 text-muted-foreground data-highlighted:bg-foreground/5 data-highlighted:text-muted-foreground sm:min-h-11!',
					shown && 'text-foreground data-highlighted:text-foreground',
				)}
				onClick={() => showSource(source.type)}
			>
				<SourceIcon source={source} />
				<div className="grid min-w-0 flex-1 leading-tight">
					<span className="truncate font-medium">{name}</span>
					<span
						className={cn(
							'truncate text-xs text-muted-foreground',
							source.status === 'reconnecting' && 'text-destructive-foreground',
						)}
					>
						{sourceStatus(source)}
					</span>
				</div>
			</MenuItem>
			<Tooltip>
				<TooltipTrigger
					render={
						<MenuItem
							aria-label={closeLabel}
							className="absolute end-1.5 size-6 min-h-6! justify-center p-0 text-muted-foreground sm:min-h-6!"
							onClick={source.type === 'log' ? closeLog : closeLive}
						/>
					}
				>
					<XIcon />
				</TooltipTrigger>
				<TooltipPopup side="right">{closeLabel}</TooltipPopup>
			</Tooltip>
		</div>
	);
}

/** Switches between the live session (on top) and the log, shown in the source menu while both are open */
export function SourceSwitcher({ live, log, shown }: { live: Source; log: Source; shown: Source['type'] | undefined }) {
	return (
		<div className="mb-1 rounded-lg bg-muted p-0.5">
			<div className="relative grid">
				<ShownIndicator index={shown === 'log' ? 1 : 0} />
				<SourceRow source={live} shown={shown === 'live'} />
				<SourceRow source={log} shown={shown === 'log'} />
			</div>
		</div>
	);
}
