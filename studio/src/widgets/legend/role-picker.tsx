import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@astryxdesign/core/DropdownMenu';
import { colorVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import { LegendMenu } from '@/widgets/legend/legend-menu';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	label: { display: 'grid', flexShrink: 0, color: colorVars['--color-text-secondary'] },
	// Each role's width, never shown
	sizer: {
		visibility: 'hidden',
		gridArea: '1 / 1',
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-0-5'],
	},
	chevron: { width: 12, height: 12 },
	current: { gridArea: '1 / 1', display: 'flex', justifySelf: 'end' },
});

/** The binding's role, as wide as the entry's widest role so picking another doesn't resize the legend and move the field beside it */
export function RoleLabel({ binding, onPick }: { binding: WidgetBinding; onPick: (role: string) => void }) {
	return (
		<span {...stylex.props(styles.label)}>
			{binding.roles.length > 1 &&
				binding.roles.map((role) => (
					<span key={role.id} aria-hidden {...stylex.props(styles.sizer)}>
						{role.label}
						<span {...stylex.props(styles.chevron)} />
					</span>
				))}
			<span {...stylex.props(styles.current)}>
				{binding.roles.length > 1 ? <RolePicker binding={binding} onPick={onPick} /> : binding.roleLabel}
			</span>
		</span>
	);
}

function RolePicker({ binding, onPick }: { binding: WidgetBinding; onPick: (role: string) => void }) {
	return (
		<LegendMenu
			label={`Draw ${binding.name} as`}
			trigger={
				<>
					{binding.roleLabel}
					<ChevronDownIcon {...stylex.props(styles.chevron)} />
				</>
			}
		>
			<DropdownMenuRadioGroup label="Draw as" value={binding.role?.id} onChange={onPick}>
				{binding.roles.map((role) => (
					<DropdownMenuRadioItem key={role.id} value={role.id} label={role.label} />
				))}
			</DropdownMenuRadioGroup>
		</LegendMenu>
	);
}
