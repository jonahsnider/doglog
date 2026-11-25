import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@astryxdesign/core/DropdownMenu';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import { LegendMenu } from '@/widgets/legend/legend-menu';
import type { WidgetBinding } from '@/widgets/widget-type';

/** The binding's role, as wide as the entry's widest role so picking another doesn't resize the legend and move the field beside it */
export function RoleLabel({ binding, onPick }: { binding: WidgetBinding; onPick: (role: string) => void }) {
	return (
		<span className="grid shrink-0 text-muted-foreground">
			{binding.roles.length > 1 &&
				binding.roles.map((role) => (
					<span key={role.id} aria-hidden className="invisible flex items-center gap-0.5 [grid-area:1/1]">
						{role.label}
						<span className="size-3" />
					</span>
				))}
			<span className="flex justify-self-end [grid-area:1/1]">
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
					<ChevronDownIcon className="size-3" />
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
