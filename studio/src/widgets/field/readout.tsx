// The row under the field widget: the cursor position and tool buttons
import { HStack } from '@astryxdesign/core/Layout';
import {
	colorVars,
	durationVars,
	easeVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import DraftingCompassIcon from 'lucide-react/icons/drafting-compass';
import PencilIcon from 'lucide-react/icons/pencil';
import RulerIcon from 'lucide-react/icons/ruler';
import type { ReactNode } from 'react';
import { InlineShortcut } from '@/components/shortcut';
import { TooltipLabel } from '@/components/tooltip-label';
import type { FieldPoint } from '@/widgets/field/geometry';
import type { FieldTool } from '@/widgets/field/pencil';
import { fieldMarker } from './markers.stylex';

const compact = '@container (width < 24rem)';

const styles = stylex.create({
	row: {
		containerType: 'inline-size',
		display: 'flex',
		flexWrap: 'wrap',
		flexShrink: 0,
		minHeight: '1.75rem',
		alignItems: 'center',
		columnGap: spacingVars['--spacing-2'],
		rowGap: spacingVars['--spacing-1'],
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
	},
	controls: { marginInlineStart: 'auto', flexShrink: 0 },
	group: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
	},
	tools: {
		display: 'flex',
		gap: spacingVars['--spacing-1'],
	},
	toolButton: { paddingInline: { default: null, [compact]: spacingVars['--spacing-1'] } },
	toolIcon: { display: { default: 'none', [compact]: 'block' } },
	toolLabel: { display: { default: 'flex', [compact]: 'none' } },
	fades: {
		transitionProperty: 'opacity',
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	// Hides controls under the field while it isn't hovered or focused, on devices that can hover
	hiddenWhileIdle: {
		opacity: {
			default: null,
			'@media (hover: hover)': {
				default: 0,
				[stylex.when.ancestor(':hover', fieldMarker)]: 1,
				[stylex.when.ancestor(':focus-within', fieldMarker)]: 1,
			},
		},
		transitionDuration: {
			default: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
			'@media (hover: hover)': {
				default: `calc(${durationVars['--duration-exit']} * var(--motion-scale))`,
				[stylex.when.ancestor(':hover', fieldMarker)]: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
				[stylex.when.ancestor(':focus-within', fieldMarker)]:
					`calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
			},
		},
	},
	position: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		whiteSpace: 'nowrap',
	},
	hidden: {
		opacity: 0,
		transitionDuration: `calc(${durationVars['--duration-exit']} * var(--motion-scale))`,
	},
	readout: {
		display: 'grid',
		marginInlineStart: `calc(-1 * ${spacingVars['--spacing-1']})`,
		paddingInline: spacingVars['--spacing-1'],
		paddingBlock: spacingVars['--spacing-0-5'],
		borderRadius: radiusVars['--radius-element'],
		transitionProperty: 'background-color, color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	copied: {
		backgroundColor: colorVars['--color-overlay-hover'],
		color: colorVars['--color-text-primary'],
	},
	// Both stay rendered so the label keeps the position's width while they cross-fade
	label: {
		gridArea: '1 / 1',
		transitionProperty: 'opacity',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	coordinates: {
		fontFamily: typographyVars['--font-family-code'],
		fontVariantNumeric: 'tabular-nums',
		// Reserve room for signed coordinates so moving the cursor doesn't move the controls to another line.
		minInlineSize: '20ch',
	},
	copiedText: {
		textAlign: 'center',
		fontWeight: fontWeightVars['--font-weight-medium'],
	},
	faded: {
		opacity: 0,
	},
});

const tools = [
	{
		tool: 'distance',
		key: 'M',
		label: 'Distance',
		icon: RulerIcon,
		hint: 'Drag to measure distance, hold Shift to snap to 45°',
	},
	{
		tool: 'angle',
		key: 'A',
		label: 'Angle',
		icon: DraftingCompassIcon,
		hint: 'Drag to measure the angle from +X, hold Shift to snap to 45°',
	},
	{ tool: 'pencil', key: 'P', label: 'Pencil', icon: PencilIcon, hint: 'Drag to sketch a line on the field' },
] as const;

/**
 * The row under the field, left out of copied images: the cursor position, then the tool buttons and `children`.
 * `measure` adds the measuring tools to the pencil.
 */
export function Readout({
	pointer,
	hovered,
	copied,
	tool,
	onToggle,
	measure = true,
	children,
}: {
	pointer: FieldPoint | undefined;
	hovered: boolean;
	copied: boolean;
	tool: FieldTool | undefined;
	onToggle: (tool: FieldTool) => void;
	measure?: boolean;
	children: ReactNode;
}) {
	const row = stylex.props(styles.row);
	return (
		<div className={`${row.className} capture-invisible`}>
			<CursorPosition pointer={pointer} hovered={hovered} copied={copied} />
			<div {...stylex.props(styles.group, styles.controls)}>
				<ToolButtons tool={tool} onToggle={onToggle} measure={measure} />
				{children}
			</div>
		</div>
	);
}

/** Controls under the field, hidden while it isn't hovered or focused unless `isShown` */
export function IdleHidden({ isShown = false, children }: { isShown?: boolean; children: ReactNode }) {
	return <div {...stylex.props(styles.group, !isShown && [styles.fades, styles.hiddenWhileIdle])}>{children}</div>;
}

function CursorPosition({
	pointer,
	hovered,
	copied,
}: {
	pointer: FieldPoint | undefined;
	hovered: boolean;
	copied: boolean;
}) {
	return (
		<span {...stylex.props(styles.position, styles.fades, !hovered && !copied && styles.hidden)}>
			<span {...stylex.props(styles.readout, copied && styles.copied)}>
				<span {...stylex.props(styles.label, styles.coordinates, copied && styles.faded)}>
					{pointer && `X ${pointer.x.toFixed(2)} m  Y ${pointer.y.toFixed(2)} m`}
				</span>
				<span {...stylex.props(styles.label, styles.copiedText, !copied && styles.faded)}>Copied</span>
			</span>
			<InlineShortcut hotkey="Mod+C" />
		</span>
	);
}

function ToolButtons({
	tool,
	onToggle,
	measure = true,
}: {
	tool: FieldTool | undefined;
	onToggle: (tool: FieldTool) => void;
	measure?: boolean;
}) {
	return (
		<div {...stylex.props(styles.tools, styles.fades, tool === undefined && styles.hiddenWhileIdle)}>
			{tools
				.filter((option) => measure || option.tool === 'pencil')
				.map(({ tool: value, key, label, icon: Icon, hint }) => (
					<Tooltip key={value} content={<TooltipLabel label={hint} shortcut={key} />}>
						<ToggleButton
							label={label}
							size="sm"
							aria-keyshortcuts={key}
							xstyle={styles.toolButton}
							isPressed={tool === value}
							onPressedChange={() => onToggle(value)}
						>
							<Icon {...stylex.props(styles.toolIcon)} size={16} aria-hidden />
							<HStack gap={1} vAlign="center" xstyle={styles.toolLabel}>
								<InlineShortcut hotkey={key} />
								{label}
							</HStack>
						</ToggleButton>
					</Tooltip>
				))}
		</div>
	);
}
