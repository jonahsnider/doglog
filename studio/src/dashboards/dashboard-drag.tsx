import {
	colorVars,
	fontWeightVars,
	radiusVars,
	shadowVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { pointerIntersection } from '@dnd-kit/collision';
import * as stylex from '@stylexjs/stylex';
import { useDragOperation, useDroppable } from '@dnd-kit/react';
import PanelLeftIcon from 'lucide-react/icons/panel-left';
import PanelRightIcon from 'lucide-react/icons/panel-right';
import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react';
import { easing, useMotionTransition } from '@/lib/motion';
import { dashboardDragType, isDashboardDrag, type SplitZoneData } from '@/dashboards/drag';
import { type Dashboard, useDashboards } from '@/dashboards/dashboards';
import { canJoinLayouts } from '@/panes/layout';
import './dashboard-drag.css';

const narrow = '@container (width < 20rem)';

const styles = stylex.create({
	zones: {
		pointerEvents: 'none',
		position: 'absolute',
		inset: spacingVars['--spacing-4'],
		zIndex: 50,
		display: 'flex',
		gap: spacingVars['--spacing-2'],
		containerType: 'inline-size',
	},
	side: {
		display: { default: 'flex', '@container (width < 3rem)': 'none' },
		flex: 1,
		alignItems: 'center',
		minWidth: 0,
	},
	right: { justifyContent: 'flex-end' },
	zone: {
		width: '11rem',
		minWidth: 0,
		height: 'min(20rem, 70%)',
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: { default: spacingVars['--spacing-2'], [narrow]: 0 },
		borderRadius: 16,
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		backgroundColor: colorVars['--color-background-popover'],
		boxShadow: shadowVars['--shadow-high'],
	},
	disabled: { opacity: 0.5 },
	target: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacingVars['--spacing-2'],
		width: '100%',
		height: '100%',
		paddingInline: { default: spacingVars['--spacing-3'], [narrow]: 0 },
		borderRadius: radiusVars['--radius-container'],
		borderWidth: 2,
		borderStyle: 'dashed',
		borderColor: colorVars['--color-border'],
		textAlign: 'center',
		overflowWrap: { default: null, [narrow]: 'anywhere' },
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: colorVars['--color-text-secondary'],
		transition:
			'color 150ms var(--ease-in-out), background-color 150ms var(--ease-in-out), border-color 150ms var(--ease-in-out)',
	},
	over: {
		borderColor: colorVars['--color-accent'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 10%, transparent)`,
		color: colorVars['--color-text-accent'],
	},
	icon: { width: 20, height: 20 },
});

/** Dragging another dashboard over the open one shows zones to add it as a left or right split */
export function DashboardSplitZones({ dashboard }: { dashboard: Dashboard }) {
	const { source } = useDragOperation();
	const draggedId = isDashboardDrag(source) ? source.data.dashboardId : undefined;
	const dragged = useDashboards().find(({ id }) => id === draggedId && id !== dashboard.id);
	const transition = useMotionTransition({ duration: 0.15, ease: easing.out });
	const exitTransition = useMotionTransition({ duration: 0.1, ease: easing.in });

	const disabled = dragged !== undefined && !canJoinLayouts([dashboard.layout, dragged.layout]);

	return (
		// Inset past the peeking sidebar's overhang, see `dashboard-drag.css`
		<div data-split-zones {...stylex.props(styles.zones)}>
			<LazyMotion features={domAnimation} strict>
				<AnimatePresence>
					{dragged &&
						(['left', 'right'] as const).map((side) => (
							<m.div
								key={side}
								{...stylex.props(styles.side, side === 'right' && styles.right)}
								initial={{ opacity: 0, x: side === 'left' ? -16 : 16 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: side === 'left' ? -16 : 16, transition: exitTransition }}
								transition={transition}
							>
								<SplitZone dashboardId={dashboard.id} side={side} disabled={disabled} />
							</m.div>
						))}
				</AnimatePresence>
			</LazyMotion>
		</div>
	);
}

function SplitZone({
	dashboardId,
	side,
	disabled,
}: {
	dashboardId: string;
	side: SplitZoneData['side'];
	disabled: boolean;
}) {
	const { ref, isDropTarget } = useDroppable<SplitZoneData>({
		id: `split-zone-${side}`,
		accept: dashboardDragType,
		data: { kind: 'split-zone', dashboardId, side },
		disabled,
		// The dragged row can overlap a zone while the pointer is still reordering dashboards in the sidebar.
		collisionDetector: pointerIntersection,
		// dnd-kit's `CollisionPriority.Highest`, above the sidebar's dashboards
		collisionPriority: 4,
	});
	const Icon = side === 'left' ? PanelLeftIcon : PanelRightIcon;

	return (
		<div ref={ref} {...stylex.props(styles.zone, disabled && styles.disabled)}>
			<div {...stylex.props(styles.target, isDropTarget && styles.over)}>
				<Icon {...stylex.props(styles.icon)} />
				{disabled ? 'Too many side by side panes' : side === 'left' ? 'Add left split' : 'Add right split'}
			</div>
		</div>
	);
}
