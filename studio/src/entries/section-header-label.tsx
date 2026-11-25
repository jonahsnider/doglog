import { colorVars, fontWeightVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import EyeOffIcon from 'lucide-react/icons/eye-off';
import ListChecksIcon from 'lucide-react/icons/list-checks';
import PinIcon from 'lucide-react/icons/pin';
import { TextMorph } from '@/components/text-morph';

const styles = stylex.create({
	icon: {
		flexShrink: 0,
		width: 14,
		height: 14,
		color: colorVars['--color-icon-secondary'],
	},
	label: {
		flex: 1,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		textAlign: 'start',
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		fontWeight: fontWeightVars['--font-weight-semibold'],
	},
	count: {
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		fontVariantNumeric: 'tabular-nums',
	},
});

const sectionHeaders = {
	active: { icon: ListChecksIcon, label: 'Active' },
	pinned: { icon: PinIcon, label: 'Pinned' },
	hidden: { icon: EyeOffIcon, label: 'Hidden' },
};

export function SectionHeaderLabel({ section, count }: { section: keyof typeof sectionHeaders; count: number }) {
	const { icon: Icon, label } = sectionHeaders[section];
	return (
		<>
			<Icon {...stylex.props(styles.icon)} />
			<span {...stylex.props(styles.label)}>{label}</span>
			<TextMorph {...stylex.props(styles.count)}>{count}</TextMorph>
		</>
	);
}
