import { useDroppable } from '@dnd-kit/react';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import { useMemo, useState } from 'react';
import { Divider } from '@astryxdesign/core/Divider';
import { colorVars, durationVars, easeVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { EditedWidget } from '@/entries/edited-widget';
import type { EntrySectionDropData } from '@/entries/drag';
import { EntryRows } from '@/entries/entry-browser-rows';
import { SectionHeaderLabel } from '@/entries/section-header-label';
import { toggleSearchGroups, type EntryTreeNode, entryTreeView } from '@/entries/tree';

const styles = stylex.create({
	section: {
		display: 'flex',
		flexDirection: 'column',
		flexShrink: 0,
		minHeight: 0,
		maxHeight: '50%',
	},
	dropTarget: {
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 8%, transparent)`,
	},
	toggle: {
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		height: 28,
		marginInline: spacingVars['--spacing-2'],
		paddingInline: '0.625rem',
		borderRadius: radiusVars['--radius-element'],
		outline: 'none',
		backgroundColor: {
			default: null,
			':hover': colorVars['--color-overlay-hover'],
			':focus-visible': colorVars['--color-overlay-hover'],
		},
	},
	chevron: {
		flexShrink: 0,
		width: 16,
		height: 16,
		color: colorVars['--color-icon-secondary'],
		transitionProperty: 'transform',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	open: {
		transform: 'rotate(90deg)',
	},
	rows: {
		minHeight: 0,
	},
});

/** Hidden entries and groups, collapsed by default and kept at the bottom of the entry browser */
export function HiddenSection({
	nodes,
	query,
	searchToggled,
	onSearchExpandedChange,
	dropTarget,
	edited,
}: {
	nodes: EntryTreeNode[];
	query: string;
	searchToggled: ReadonlySet<string>;
	onSearchExpandedChange: (expanded: string[], next: string[]) => void;
	dropTarget: boolean;
	edited: EditedWidget | undefined;
}) {
	const [open, setOpen] = useState(false);
	const [expanded, setExpanded] = useState<string[]>([]);
	// oxlint-disable-next-line studio/no-manual-memo -- Without it, React Compiler also reruns this when search groups are toggled
	const results = useMemo(() => entryTreeView(nodes, expanded, query, 'hidden'), [nodes, expanded, query]);
	const view = toggleSearchGroups(results, searchToggled, 'hidden');
	const { ref } = useDroppable<EntrySectionDropData>({
		id: 'hidden',
		accept: (source) => source.data['section'] !== undefined,
		data: { section: 'hidden' },
	});

	return (
		<section ref={ref} aria-label="Hidden entries" {...stylex.props(styles.section, dropTarget && styles.dropTarget)}>
			<Divider />
			<button type="button" aria-expanded={open} {...stylex.props(styles.toggle)} onClick={() => setOpen(!open)}>
				<ChevronRightIcon {...stylex.props(styles.chevron, open && styles.open)} />
				<SectionHeaderLabel section="hidden" count={view.items.length} />
			</button>
			{open && (
				<EntryRows
					view={view}
					label="Hidden entries"
					xstyle={styles.rows}
					// The whole section shows where rows will be dropped
					dropSection={undefined}
					edited={edited}
					onExpandedChange={(next) => {
						if (view.highlights) {
							onSearchExpandedChange(view.expanded, next);
						} else {
							setExpanded(next);
						}
					}}
				/>
			)}
		</section>
	);
}
