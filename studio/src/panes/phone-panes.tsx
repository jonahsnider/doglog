import { easeVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import { allowedActions, splitDashboardPane } from '@/dashboards/panes';
import { focusPane } from '@/dashboards/pane-state';
import { useSource } from '@/data/source-store';
import { useOnScreenKeyboard } from '@/hooks/use-on-screen-keyboard';
import { duration, reducesMotion } from '@/lib/motion';
import { type PaneNode, panes } from '@/panes/layout';
import { PaneBar } from '@/panes/pane-bar';
import type { PaneHosts } from '@/panes/pane-hosts';
import { PaneMinimap } from '@/panes/pane-minimap';
import { type PaneRect, paneRects, placeBarHighlight, placeMinimapHighlight } from '@/panes/pane-highlights';
import { PaneSlot } from '@/panes/pane-slot';
import type { SwipeHandler, Swipes } from '@/panes/pane-swipe';

// The phone layout shows one pane at a time. Its panes sit side by side in reading order, and the dashboard slides
// between them. `--pane-position` is the pane in view, fractional mid-swipe and past the ends while resisting a swipe.
// `--pane-index` is the same within the panes, which the pane bar's highlight follows.

/** In pixels, swipes starting this close to the screen's edge are left to the browser, which goes back with them */
const screenEdge = 20;
/** Release speed in px/s that switches panes however far the swipe went */
const flickSpeed = 500;
/** How long the minimap stays after the last switch, in milliseconds */
const minimapDelay = 1500;

const styles = stylex.create({
	panes: { display: 'flex', flexDirection: 'column', height: '100%' },
	viewport: { position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' },
	// Moved with `left` rather than a transform, which would move widgets' fixed popups along with it
	track: {
		position: 'relative',
		display: 'flex',
		gap: spacingVars['--spacing-1-5'],
		height: '100%',
		left: `calc(var(--pane-position, 0) * (-100% - ${spacingVars['--spacing-1-5']}))`,
		transitionProperty: 'left',
		transitionDuration: 'var(--pane-duration, 0ms)',
		transitionTimingFunction: easeVars['--ease-move'],
	},
	slot: { flex: '0 0 100%', minWidth: 0, height: '100%' },
});

/** A swipe past the first or last pane moves less and less the further it goes, like iOS's rubber band */
function resist(position: number, count: number): number {
	const last = count - 1;
	const past = position < 0 ? -position : position - last;
	if (past <= 0) {
		return position;
	}
	const resisted = 1 - 1 / (past * 0.55 + 1);
	return position < 0 ? -resisted : last + resisted;
}

/** Puts the panes and the highlights at `position`, sliding them there if `animate` */
function placePanes(root: HTMLElement | null, rects: readonly PaneRect[], position: number, animate: boolean): void {
	if (!root) {
		return;
	}
	const index = Math.min(Math.max(position, 0), rects.length - 1);
	const ms = animate && !reducesMotion() ? duration.medium * 1000 : 0;
	root.style.setProperty('--pane-position', String(position));
	root.style.setProperty('--pane-index', String(index));
	root.style.setProperty('--pane-duration', `${ms}ms`);
	placeMinimapHighlight(root, rects, index, ms);
	placeBarHighlight(root, index);
}

/**
 * A dashboard in the phone layout. Its focused pane fills the dashboard, swiping a pane's header goes to the panes
 * beside it, and the pane bar below switches between them and adds more.
 * @param swipes Swipes on pane headers, which `PaneSwipeContext` passes along
 */
export function PhonePanes({
	dashboardId,
	layout,
	focusedPaneId,
	hosts,
	swipes,
}: {
	dashboardId: string;
	layout: PaneNode;
	focusedPaneId: string;
	hosts: PaneHosts;
	swipes: Swipes;
}) {
	const order = panes(layout);
	const rects = paneRects(layout);
	const index = Math.max(
		order.findIndex((pane) => pane.id === focusedPaneId),
		0,
	);
	const shown = order[index];
	const root = useRef<HTMLDivElement>(null);
	const viewport = useRef<HTMLDivElement>(null);
	const keyboard = useOnScreenKeyboard();
	// The timeline bar shows below the dashboard while it has a source
	const timeline = useSource() !== undefined;
	const idPrefix = useId();
	const [swiping, setSwiping] = useState(false);
	// The pane the minimap last showed up for, `undefined` once it's faded out
	const [minimapFor, setMinimapFor] = useState<string>();
	const [previousId, setPreviousId] = useState(shown?.id);
	if (previousId !== shown?.id) {
		setPreviousId(shown?.id);
		setMinimapFor(shown?.id);
	}

	const placed = useRef(false);
	useLayoutEffect(() => {
		// Slides to panes chosen after the first render, and moves the minimap's highlight as the layout changes
		placePanes(root.current, paneRects(layout), index, placed.current);
		placed.current = true;
	}, [index, layout]);

	useEffect(() => {
		if (minimapFor === undefined || swiping) {
			return undefined;
		}
		const timer = setTimeout(() => setMinimapFor(undefined), minimapDelay);
		return () => clearTimeout(timer);
	}, [minimapFor, swiping]);

	// Pans don't say where they started, so it's read from the press that starts one
	const pressX = useRef(0);
	useEffect(() => {
		const element = root.current!;
		const onPointerDown = (event: PointerEvent) => {
			pressX.current = event.clientX;
		};
		element.addEventListener('pointerdown', onPointerDown, { capture: true });
		return () => element.removeEventListener('pointerdown', onPointerDown, { capture: true });
	}, []);

	const ignored = useRef(false);
	const onPan = useEffectEvent<SwipeHandler>(({ state, translation, velocity }) => {
		const width = viewport.current?.clientWidth ?? 0;
		if (state === 'began') {
			ignored.current = width === 0 || pressX.current < screenEdge || pressX.current > window.innerWidth - screenEdge;
			if (!ignored.current) {
				setSwiping(true);
				setMinimapFor(shown?.id);
			}
		}
		if (ignored.current) {
			return;
		}

		// In panes, toward the next one
		const moved = -translation.x / width;
		if (state === 'began' || state === 'changed') {
			placePanes(root.current, rects, resist(index + moved, order.length), false);
			return;
		}

		setSwiping(false);
		const speed = -velocity.x;
		let target = index;
		if (state === 'ended') {
			if (speed > flickSpeed || (moved > 0.5 && speed > -flickSpeed)) {
				target = index + 1;
			} else if (speed < -flickSpeed || (moved < -0.5 && speed < flickSpeed)) {
				target = index - 1;
			}
		}
		const next = order[target];
		if (target !== index && next) {
			focusPane(dashboardId, next.id);
		} else {
			placePanes(root.current, rects, index, true);
		}
	});
	useEffect(() => swipes.subscribe((event) => onPan(event)), [swipes]);

	/** Dragging along the pane bar slides the panes with the finger, and settles on the nearest one once released */
	const onScrub = (position: number, ended: boolean) => {
		setSwiping(!ended);
		setMinimapFor(shown?.id);
		const next = order[Math.round(position)];
		if (!ended) {
			placePanes(root.current, rects, position, false);
		} else if (next && next.id !== shown?.id) {
			focusPane(dashboardId, next.id);
		} else {
			placePanes(root.current, rects, index, true);
		}
	};

	const allowed = shown && allowedActions(dashboardId, layout, shown.id);
	const direction = allowed?.splitRight === true ? 'row' : allowed?.splitDown === true ? 'column' : undefined;
	return (
		<div ref={root} {...stylex.props(styles.panes)}>
			<div ref={viewport} {...stylex.props(styles.viewport)}>
				<div {...stylex.props(styles.track)}>
					{order.map((pane, paneIndex) => (
						<div
							key={pane.id}
							id={`${idPrefix}-panel-${pane.id}`}
							role="tabpanel"
							aria-labelledby={`${idPrefix}-tab-${pane.id}`}
							inert={paneIndex !== index}
							{...stylex.props(styles.slot)}
						>
							<PaneSlot hosts={hosts} paneId={pane.id} />
						</div>
					))}
				</div>
				{order.length > 1 && <PaneMinimap rects={rects} shown={minimapFor !== undefined && !keyboard} />}
			</div>
			{!keyboard && (
				<PaneBar
					idPrefix={idPrefix}
					order={order}
					shownId={shown?.id}
					onSelect={(paneId) => focusPane(dashboardId, paneId)}
					onScrub={onScrub}
					onAdd={shown && direction ? () => splitDashboardPane(dashboardId, shown.id, direction) : undefined}
					atBottom={!timeline}
				/>
			)}
		</div>
	);
}
