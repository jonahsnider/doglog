import { colorVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
	noData: {
		color: colorVars['--color-text-secondary'],
	},
});

/** Shown in place of a bound entry's data when no visible source has it */
export function NoData() {
	return <span {...stylex.props(styles.noData)}>No data</span>;
}
