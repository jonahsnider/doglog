import { IconButton } from '@astryxdesign/core/IconButton';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import {
	borderVars,
	colorVars,
	radiusVars,
	shadowVars,
	sizeVars,
	spacingVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import LayoutDashboardIcon from 'lucide-react/icons/layout-dashboard';
import PlusIcon from 'lucide-react/icons/plus';
import { type PointerEvent, useRef } from 'react';
import { placeBarHighlight } from '@/panes/pane-highlights';
import type { Pane } from '@/panes/layout';
import { getWidgetType } from '@/widgets/registry';
import './pane-bar.css';

const styles = stylex.create({
	bar: {
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacingVars['--spacing-2'],
		paddingTop: spacingVars['--spacing-1-5'],
	},
	pill: {
		display: 'flex',
		minWidth: 0,
		padding: spacingVars['--spacing-1'],
		borderWidth: borderVars['--border-width'],
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-background-popover'],
		boxShadow: shadowVars['--shadow-low'],
	},
	tabs: { minWidth: 0 },
	// Square, with the highlight in `pane-bar.css` behind the icon instead of the tab's underline
	tab: {
		width: sizeVars['--size-element-lg'],
		paddingInline: 0,
		borderRadius: radiusVars['--radius-full'],
	},
	add: { borderRadius: radiusVars['--radius-full'] },
});

/** In pixels, how far a press moves along the bar before it scrubs instead of tapping */
const scrubSlop = 6;
/** In pixels, how far the bar scrolls on each move while the finger is near its end */
const edgeScroll = 6;

/**
 * Where `x` is along the bar's tabs, as a pane position: a tab's index at its center, and fractional between two
 * centers, so the panes slide between those two as the finger does
 */
function positionAt(bar: HTMLElement, x: number): number | undefined {
	const centers = [...bar.querySelectorAll<HTMLElement>('[data-tab-value]')].map((tab) => {
		const rect = tab.getBoundingClientRect();
		return rect.left + rect.width / 2;
	});
	const after = centers.findIndex((center) => center > x);
	if (centers.length === 0 || after === 0) {
		return centers.length === 0 ? undefined : 0;
	}
	if (after === -1) {
		return centers.length - 1;
	}
	const start = centers[after - 1]!;
	return after - 1 + (x - start) / (centers[after]! - start);
}

/** Focusing a tab from the keyboard pads the strip the highlight is drawn on, so it's measured again */
function remeasure(element: HTMLElement): void {
	placeBarHighlight(element, Number(getComputedStyle(element).getPropertyValue('--pane-index')) || 0);
}

/**
 * The phone layout's bar of a tab for each pane, which switches to it, and a button that adds a pane. Dragging along
 * the tabs moves the panes with the finger, see `onScrub`, and the selected pane's highlight follows swipes between panes.
 * @param idPrefix Tabs are `${idPrefix}-tab-${paneId}`, and control the panes `${idPrefix}-panel-${paneId}`
 */
export function PaneBar({
	idPrefix,
	order,
	shownId,
	onSelect,
	onScrub,
	onAdd,
}: {
	idPrefix: string;
	order: Pane[];
	shownId: string | undefined;
	onSelect: (paneId: string) => void;
	/** A drag along the tabs at `position`, see `positionAt()`. It settles on the nearest pane once `ended`. */
	onScrub: (position: number, ended: boolean) => void;
	/** `undefined` when the shown pane can't be split */
	onAdd: (() => void) | undefined;
}) {
	// Where the press that may become a scrub started, and whether it has
	const press = useRef<{ x: number; scrubbing: boolean }>(undefined);
	// A scrub ends with a click on the tab it started on, which mustn't select that tab
	const scrubbed = useRef(false);
	const scrub = (event: PointerEvent<HTMLElement>, ended: boolean) => {
		const position = positionAt(event.currentTarget, event.clientX);
		if (position !== undefined) {
			onScrub(position, ended);
		}
	};
	return (
		<div {...stylex.props(styles.bar)}>
			<div data-pane-bar {...stylex.props(styles.pill)}>
				<TabList
					role="tablist"
					aria-label="Switch pane"
					size="lg"
					value={shownId ?? ''}
					onChange={onSelect}
					xstyle={styles.tabs}
					onPointerDown={(event) => {
						scrubbed.current = false;
						press.current = event.button === 0 ? { x: event.clientX, scrubbing: false } : undefined;
					}}
					onPointerMove={(event) => {
						const element = event.currentTarget;
						if (!press.current || (event.pointerType === 'mouse' && event.buttons !== 1)) {
							return;
						}
						if (!press.current.scrubbing) {
							if (Math.abs(event.clientX - press.current.x) < scrubSlop) {
								return;
							}
							// Only now, so a tap still clicks its tab
							press.current.scrubbing = true;
							element.setPointerCapture(event.pointerId);
						}
						// Scrolls along while the finger is near an end of an overflowing bar
						const rect = element.getBoundingClientRect();
						const tab = rect.height;
						if (event.clientX < rect.left + tab) {
							element.scrollLeft -= edgeScroll;
						} else if (event.clientX > rect.right - tab) {
							element.scrollLeft += edgeScroll;
						}
						scrub(event, false);
					}}
					onPointerUp={(event) => {
						if (press.current?.scrubbing === true) {
							scrubbed.current = true;
							scrub(event, true);
						}
						press.current = undefined;
					}}
					onPointerCancel={(event) => {
						if (press.current?.scrubbing === true) {
							scrub(event, true);
						}
						press.current = undefined;
					}}
					onClickCapture={(event) => {
						if (scrubbed.current) {
							scrubbed.current = false;
							event.preventDefault();
						}
					}}
					// Long-pressing a tab does nothing
					onContextMenu={(event) => event.preventDefault()}
					onFocus={(event) => remeasure(event.currentTarget)}
					onBlur={(event) => remeasure(event.currentTarget)}
				>
					{order.map((pane) => {
						const type = pane.widget && getWidgetType(pane.widget.type);
						const Icon = type?.icon ?? LayoutDashboardIcon;
						return (
							<Tab
								key={pane.id}
								id={`${idPrefix}-tab-${pane.id}`}
								panelId={`${idPrefix}-panel-${pane.id}`}
								value={pane.id}
								label={type?.name ?? pane.widget?.type ?? 'Empty pane'}
								isLabelHidden
								icon={<Icon aria-hidden />}
								xstyle={styles.tab}
							/>
						);
					})}
				</TabList>
			</div>
			<IconButton
				label="Add pane"
				tooltip="Add pane"
				icon={<PlusIcon aria-hidden />}
				size="lg"
				elevation="low"
				isDisabled={onAdd === undefined}
				onClick={onAdd}
				xstyle={styles.add}
			/>
		</div>
	);
}
