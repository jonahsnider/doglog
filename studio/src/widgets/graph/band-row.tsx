import { colorVars, spacingVars, typeScaleVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useBindingDrag } from '@/entries/drag';
import { EntryName } from '@/entries/entry-name';
import { bandHeight, bandTop, labelHeight, rowHeight } from '@/widgets/graph/bands';
import { NoData } from '@/widgets/no-data';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	row: {
		position: 'absolute',
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
	},
	label: {
		display: 'flex',
		maxWidth: '100%',
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		paddingTop: spacingVars['--spacing-0-5'],
	},
	name: {
		minWidth: 0,
		cursor: 'grab',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		fontFamily: typographyVars['--font-family-code'],
		color: colorVars['--color-text-secondary'],
	},
	noData: {
		display: 'flex',
		alignItems: 'center',
	},
});

/** A discrete entry's name above its bands, which are drawn on a canvas behind it */
export function BandRow({
	binding,
	row,
	insets,
}: {
	binding: WidgetBinding;
	row: number;
	insets: { left: number; right: number };
}) {
	const { ref, handleRef } = useBindingDrag(binding, { dropRole: 'discrete' });
	return (
		<div
			ref={ref}
			{...stylex.props(styles.row)}
			style={{ top: row * rowHeight, height: rowHeight, left: insets.left, right: insets.right }}
			// Right-clicking the row offers to remove its binding, middle-clicking removes it
			data-binding-id={binding.id}
		>
			<div {...stylex.props(styles.label)} data-graph-label>
				{/* Dragged by the name, dragging the band pans. Numbers can be moved back to an axis from the context menu. */}
				<span ref={handleRef} {...stylex.props(styles.name)}>
					<EntryName name={binding.name} />
				</span>
			</div>
			{!binding.entry && (
				<div {...stylex.props(styles.noData)} style={{ height: bandHeight, marginTop: bandTop - labelHeight - 2 }}>
					<NoData />
				</div>
			)}
		</div>
	);
}
