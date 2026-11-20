import { Select as SelectPrimitive } from '@base-ui/react/select';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import { useRef } from 'react';
import { Select, SelectItem, SelectPopup } from '@/components/ui/select';
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
	const keyboardSelection = useRef(false);
	return (
		<Select
			value={binding.role?.id ?? null}
			onValueChange={(role) => {
				if (role !== null) {
					onPick(role);
				}
			}}
			onOpenChange={(_open, { reason, event }) => {
				// Base UI doesn't pass the interaction type to finalFocus when an option is selected.
				keyboardSelection.current = reason === 'item-press' && event instanceof MouseEvent && event.detail === 0;
			}}
		>
			<SelectPrimitive.Trigger
				className="-mx-1 flex shrink-0 cursor-pointer items-center gap-0.5 rounded-sm px-1 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-accent-foreground"
				aria-label={`Draw ${binding.name} as`}
			>
				{binding.roleLabel}
				<ChevronDownIcon className="size-3" />
			</SelectPrimitive.Trigger>
			{/* Only restore keyboard focus, so Space plays or pauses after picking with the mouse. */}
			<SelectPopup
				alignItemWithTrigger={false}
				finalFocus={(closeType) => closeType === 'keyboard' || keyboardSelection.current}
			>
				{binding.roles.map((role) => (
					<SelectItem key={role.id} value={role.id}>
						{role.label}
					</SelectItem>
				))}
			</SelectPopup>
		</Select>
	);
}
