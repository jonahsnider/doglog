import { colorVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { PaneNode } from '@/panes/layout';
import { childSizes } from '@/panes/split-sizes';
import { getWidgetType } from '@/widgets/registry';

const styles = stylex.create({
	preview: {
		display: 'flex',
		width: '12rem',
		aspectRatio: '16 / 9',
	},
	pane: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
		height: '100%',
		borderRadius: radiusVars['--radius-inner'],
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		backgroundColor: colorVars['--color-background-muted'],
		color: colorVars['--color-icon-secondary'],
	},
	icon: { width: 16, height: 16 },
	split: {
		display: 'flex',
		gap: spacingVars['--spacing-1'],
		width: '100%',
		height: '100%',
	},
	column: { flexDirection: 'column' },
	// Basis 0 so each child's share of the space matches its size
	child: (size: number) => ({
		display: 'flex',
		flex: `${size} 1 0`,
		minWidth: 0,
		minHeight: 0,
	}),
});

/** A miniature of a dashboard's layout, each pane showing its widget's icon */
export function DashboardPreview({ layout }: { layout: PaneNode }) {
	return (
		<div {...stylex.props(styles.preview)}>
			<PreviewNode node={layout} />
		</div>
	);
}

function PreviewNode({ node }: { node: PaneNode }) {
	if (node.kind === 'pane') {
		const Icon = node.widget === undefined ? undefined : getWidgetType(node.widget.type)?.icon;
		return <div {...stylex.props(styles.pane)}>{Icon && <Icon {...stylex.props(styles.icon)} />}</div>;
	}

	const sizes = childSizes(node);
	return (
		<div {...stylex.props(styles.split, node.direction === 'column' && styles.column)}>
			{node.children.map((child, index) => (
				<div key={child.id} {...stylex.props(styles.child(sizes[index]!))}>
					<PreviewNode node={child} />
				</div>
			))}
		</div>
	);
}
