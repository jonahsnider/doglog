import {
	colorVars,
	fontWeightVars,
	radiusVars,
	shadowVars,
	spacingVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { Feedback } from '@dnd-kit/dom';
import * as stylex from '@stylexjs/stylex';
import { DragDropProvider, DragOverlay, KeyboardSensor } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import LayoutDashboardIcon from 'lucide-react/icons/layout-dashboard';
import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { EntryName } from '@/entries/entry-name';
import { combineDashboards, moveDashboardPane, movePaneToNewDashboard } from '@/dashboards/panes';
import { isDashboardDrag, isSplitZone } from '@/dashboards/drag';
import { moveDashboard } from '@/dashboards/dashboards';
import { moveDashboardToSection } from '@/dashboards/sharing';
import { entryPointerSensor, isEntryDrag, isEntryRowDrag } from '@/entries/drag';
import { isNewDashboardDrop, isPaneDrag, isPaneDrop, nearestSide, type PaneDragData } from '@/panes/drag';
import { getWidgetType } from '@/widgets/registry';
import { dropSource, isSourceDrag } from '@/sidebar/move-source';

const styles = stylex.create({
	preview: {
		width: 'max-content',
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		backgroundColor: colorVars['--color-background-popover'],
		color: colorVars['--color-text-primary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
	},
	entry: {
		maxWidth: '20rem',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		borderRadius: radiusVars['--radius-element'],
		paddingBlock: spacingVars['--spacing-1'],
		paddingInline: spacingVars['--spacing-2'],
		fontFamily: typographyVars['--font-family-code'],
		boxShadow: shadowVars['--shadow-med'],
	},
	pane: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		borderRadius: radiusVars['--radius-element'],
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-3'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		boxShadow: shadowVars['--shadow-high'],
	},
	icon: {
		width: 14,
		height: 14,
	},
});

/** Sensors of entries, dashboards and panes use their own */
const sensors = [entryPointerSensor, KeyboardSensor];

/**
 * Lets dashboards, panes, and entries be dragged anywhere in the app:
 * dashboards to reorder them or onto the open dashboard's split zones, panes beside other panes or onto the sidebar,
 * sources to reorder them or move them to other windows,
 * entries onto widgets (handled by `DashboardPanes`), and entry browser rows between its sections (handled by `EntryBrowser`).
 */
export function DragProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	return (
		<DragDropProvider
			sensors={sensors}
			onDragStart={({ operation }, manager) => {
				// Undoes skipping the drop animation below. Previews never animate back, their source may be gone by then,
				// ex. an entry moved to another axis's legend, and they'd fly to the corner of the window.
				const feedback = manager.registry.plugins.get(Feedback);
				if (feedback) {
					feedback.dropAnimation = hasPreview(operation.source) ? null : undefined;
				}
			}}
			onDragEnd={({ operation, canceled, nativeEvent }, manager) => {
				const { source, target } = operation;
				if (canceled || !source) {
					return;
				}

				const drop = target?.data;
				if (isPaneDrag(source)) {
					const { dashboardId, paneId } = source.data;
					if (isPaneDrop(drop) && target?.element) {
						const side = nearestSide(target.element.getBoundingClientRect(), operation.position.current);
						moveDashboardPane(dashboardId, paneId, drop.paneId, side);
					} else if (isNewDashboardDrop(drop)) {
						movePaneToNewDashboard(dashboardId, paneId, drop.shared, drop.index);
					}
				} else if (isDashboardDrag(source)) {
					const { dashboardId } = source.data;
					if (isSplitZone(drop)) {
						combineDashboards(drop.dashboardId, dashboardId, drop.side);
					} else if (isNewDashboardDrop(drop)) {
						moveDashboardToSection(router, dashboardId, drop.shared, drop.index);
						// It shows up in the other section right away, instead of flying back to its old spot as it's removed
						const feedback = manager.registry.plugins.get(Feedback);
						if (feedback) {
							feedback.dropAnimation = null;
						}
					} else if (isSortable(source)) {
						moveDashboard(dashboardId, source.index);
					}
				} else if (isSourceDrag(source) && dropSource(source, nativeEvent)) {
					// It moves to another window, instead of flying back to its row
					const feedback = manager.registry.plugins.get(Feedback);
					if (feedback) {
						feedback.dropAnimation = null;
					}
				}
			}}
		>
			{children}
			{/* Entry browser rows are virtualized and can unmount mid-drag, and panes are too big to drag around, so a preview follows the pointer instead. Dashboards move in the sidebar. */}
			<DragOverlay dropAnimation={null} disabled={(source) => !hasPreview(source)}>
				{(source) =>
					isPaneDrag(source) ? (
						<PanePreview data={source.data} />
					) : (
						(isEntryDrag(source) || isEntryRowDrag(source)) && (
							<div {...stylex.props(styles.preview, styles.entry)}>
								<EntryName name={source.data.name} />
							</div>
						)
					)
				}
			</DragOverlay>
		</DragDropProvider>
	);
}

/** Whether a preview follows the pointer while dragging `source`, instead of the source itself moving */
function hasPreview(source: Parameters<typeof isPaneDrag>[0]): boolean {
	return isEntryDrag(source) || isEntryRowDrag(source) || isPaneDrag(source);
}

function PanePreview({ data }: { data: PaneDragData }) {
	const type = data.widgetType === undefined ? undefined : getWidgetType(data.widgetType);
	const Icon = type?.icon ?? LayoutDashboardIcon;
	return (
		<div {...stylex.props(styles.preview, styles.pane)}>
			<Icon {...stylex.props(styles.icon)} />
			{type?.name ?? 'Empty pane'}
		</div>
	);
}
