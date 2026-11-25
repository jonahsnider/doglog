import { colorVars, radiusVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import { TreeItemIndicator } from '@ui-sdk/react/tree';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import { HighlightedText } from '@/components/highlighted-text';
import { EntryName } from '@/entries/entry-name';
import { entryBrowserMarker } from './markers.stylex';
import type { EntryTreeNode } from '@/entries/tree';

const styles = stylex.create({
	guides: {
		position: 'absolute',
		insetBlock: 0,
		insetInlineStart: '1.0625rem',
		pointerEvents: 'none',
		backgroundImage: `repeating-linear-gradient(to right, ${colorVars['--color-border']} 0 1px, transparent 1px 12px)`,
		opacity: { default: 0, [stylex.when.ancestor(':hover', entryBrowserMarker)]: 1 },
		transitionProperty: 'opacity',
		transitionDuration: '100ms',
		transitionTimingFunction: 'var(--ease-in-out)',
	},
	activeGuide: {
		position: 'absolute',
		insetBlock: 0,
		width: 1,
		pointerEvents: 'none',
		backgroundColor: colorVars['--color-border-emphasized'],
	},
	containsBound: {
		flexShrink: 0,
		width: 6,
		height: 6,
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-accent'],
	},
	indicator: {
		flexShrink: 0,
		color: colorVars['--color-icon-secondary'],
		transform: { default: null, ':is([data-expanded])': 'rotate(90deg)' },
		transitionProperty: 'transform',
		transitionDuration: '150ms',
		transitionTimingFunction: 'var(--ease-in-out)',
	},
	chevron: {
		flexShrink: 0,
		width: 16,
		height: 16,
	},
	name: {
		flex: 1,
		minWidth: 0,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
	unsupported: {
		color: colorVars['--color-text-secondary'],
	},
	bound: {
		color: colorVars['--color-text-accent'],
	},
});

/**
 * A line under each ancestor's chevron, so deep rows can be followed up to their groups. They're shown while hovering
 * the entry browser, except the `active` group's, which is always shown and stands out.
 */
export function IndentGuides({ level, active }: { level: number; active: number | undefined }) {
	return (
		level > 1 && (
			<>
				<span aria-hidden {...stylex.props(styles.guides)} style={{ width: (level - 1) * 12 - 11 }} />
				{active !== undefined && (
					<span
						aria-hidden
						{...stylex.props(styles.activeGuide)}
						style={{ insetInlineStart: 17 + (active - 1) * 12 }}
					/>
				)}
			</>
		)
	);
}

export function ContainsBoundMark() {
	return <span role="img" aria-label="Has active entries" {...stylex.props(styles.containsBound)} />;
}

/** Chevron of rows with children. Leaves show their type mark in its place. */
export function RowIndicator({ expandable }: { expandable: boolean }) {
	return (
		expandable && (
			<TreeItemIndicator {...stylex.props(styles.indicator)}>
				<ChevronRightIcon {...stylex.props(styles.chevron)} />
			</TreeItemIndicator>
		)
	);
}

export function RowLabel({
	node,
	highlights,
	unsupported,
	bound,
}: {
	node: EntryTreeNode;
	highlights: readonly number[] | undefined;
	unsupported: boolean;
	bound: boolean;
}) {
	return (
		<Tooltip content={node.value} hasHoverIndication={false}>
			<span {...stylex.props(styles.name, unsupported && styles.unsupported, bound && styles.bound)}>
				{/* The tops of pinned and hidden entries and groups are labeled with their full paths */}
				{node.label === node.value ? (
					<EntryName name={node.value} ranges={highlights} />
				) : (
					<HighlightedText text={node.label} ranges={highlights} />
				)}
			</span>
		</Tooltip>
	);
}
