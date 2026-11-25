import { useMemo } from 'react';
import { Divider } from '@astryxdesign/core/Divider';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { EditedWidget } from '@/entries/edited-widget';
import { EntryRows } from '@/entries/entry-browser-rows';
import { SectionHeaderLabel } from '@/entries/section-header-label';
import { type EntryTreeNode, entryTreeView } from '@/entries/tree';

const styles = stylex.create({
	section: {
		display: 'flex',
		flexDirection: 'column',
		flexShrink: 0,
		minHeight: 0,
		maxHeight: '33.333333%',
	},
	header: {
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		height: 28,
		paddingInline: '1.125rem',
	},
	rows: {
		minHeight: 0,
	},
});

/**
 * The entries the edited widget showed when editing it started, listed again at the top of the entry browser.
 * Unbinding one keeps it here, so rows don't move while toggling them.
 */
export function ActiveSection({
	nodes,
	query,
	edited,
}: {
	nodes: EntryTreeNode[];
	query: string;
	edited: EditedWidget;
}) {
	const view = useMemo(() => entryTreeView(nodes, [], query, 'active'), [nodes, query]);
	if (view.items.length === 0) {
		return null;
	}

	return (
		<section aria-label="Active entries" {...stylex.props(styles.section)}>
			<div {...stylex.props(styles.header)}>
				{/* Counts matches while searching */}
				<SectionHeaderLabel section="active" count={view.items.length} />
			</div>
			<EntryRows
				view={view}
				label="Active entries"
				xstyle={styles.rows}
				dropSection={undefined}
				edited={edited}
				// Its rows are all entries, there's nothing to expand
				onExpandedChange={() => undefined}
			/>
			<Divider />
		</section>
	);
}
