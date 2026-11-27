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
import { focusOutlineProps } from '@astryxdesign/core/utils/focusOutline.stylex';
import * as stylex from '@stylexjs/stylex';
import LayoutDashboardIcon from 'lucide-react/icons/layout-dashboard';
import MoveIcon from 'lucide-react/icons/move';
import { paneTitleMarker } from './markers.stylex';
import { bindsEntries, type WidgetType } from '@/widgets/widget-type';

const styles = stylex.create({
	title: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		minWidth: 0,
		marginInlineStart: `calc(${spacingVars['--spacing-1']} * -1)`,
		paddingBlock: spacingVars['--spacing-0-5'],
		paddingInline: spacingVars['--spacing-1'],
		borderRadius: radiusVars['--radius-element'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: colorVars['--color-text-secondary'],
		transitionProperty: 'color, background-color',
		transitionDuration: durationVars['--duration-fast-min'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	movable: {
		backgroundColor: { default: null, ':hover': colorVars['--color-overlay-hover'] },
		color: { default: colorVars['--color-text-secondary'], ':hover': colorVars['--color-text-primary'] },
	},
	dragged: {
		backgroundColor: colorVars['--color-overlay-hover'],
		color: colorVars['--color-text-primary'],
	},
	icon: {
		flexShrink: 0,
		width: 14,
		height: 14,
	},
	// The widget's icon makes way for the move icon while the title is hovered or dragged
	movableIcon: {
		display: { default: null, [stylex.when.ancestor(':hover', paneTitleMarker)]: 'none' },
	},
	moveIcon: {
		display: { default: 'none', [stylex.when.ancestor(':hover', paneTitleMarker)]: 'block' },
	},
	draggedIcon: {
		display: 'none',
	},
	draggedMoveIcon: {
		display: 'block',
	},
	// Source Sans 3 is smaller than IBM Plex Sans, so it's a size up, keeping the line height so the header doesn't grow
	name: {
		// Keep the start readable even when there's only room for one character.
		'--overflow-fade-width': `min(${spacingVars['--spacing-8']}, 50%)`,
		whiteSpace: 'nowrap',
		fontFamily: typographyVars['--font-family-heading'],
		fontSize: textSizeVars['--font-size-base'],
		lineHeight: '1rem',
	},
});

/**
 * Panes are dragged by their title, which shows a move icon and a background while hovered or dragged. Empty panes, which have no name, get one too so they can be dragged.
 * Titles of panes that aren't `movable` don't change while hovered.
 * Double-clicking it edits the widget's entries, for widgets that take them.
 */
export function PaneTitle({
	dragRef,
	movable,
	isDragging,
	type,
	name,
	onEdit,
}: {
	dragRef: (element: Element | null) => void;
	movable: boolean;
	isDragging: boolean;
	type: WidgetType | undefined;
	name: string | undefined;
	onEdit: () => void;
}) {
	const Icon = name === undefined ? LayoutDashboardIcon : type?.icon;
	const nameStyle = stylex.props(styles.name);
	return (
		<span
			ref={dragRef}
			onDoubleClick={type && bindsEntries(type) ? onEdit : undefined}
			{...focusOutlineProps.focusVisible(
				paneTitleMarker,
				styles.title,
				movable && styles.movable,
				movable && isDragging && styles.dragged,
			)}
		>
			{Icon && (
				<Icon
					{...stylex.props(styles.icon, movable && styles.movableIcon, movable && isDragging && styles.draggedIcon)}
				/>
			)}
			{movable && <MoveIcon {...stylex.props(styles.icon, styles.moveIcon, isDragging && styles.draggedMoveIcon)} />}
			<span {...nameStyle} className={`${nameStyle.className} overflow-fade`}>
				{name ?? 'Empty pane'}
			</span>
		</span>
	);
}
