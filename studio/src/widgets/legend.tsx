import { ChevronDownIcon } from 'lucide-react';
import { type ReactNode, use } from 'react';
import { EntryName } from '@/components/entry-name';
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu';
import { useBindingDrag, WidgetBindingsContext } from '@/entry-drag';
import { cn } from '@/lib/utils';
import type { WidgetBinding } from '@/widgets/widget-type';

export type LegendItem = {
	binding: WidgetBinding;
	/** Swatch color, ignored when there's an `icon` */
	color?: string;
	icon?: ReactNode;
	/** Shown dimmed after the name */
	note?: string;
	/** Has no value at the cursor */
	dimmed: boolean;
	error?: string;
};

/** Names each binding of a drawn widget with its color, in wrapping rows or with one `vertical` item per row */
export function Legend({ items, vertical = false }: { items: LegendItem[]; vertical?: boolean }) {
	return (
		<ul className={cn('flex gap-x-3 gap-y-1 text-xs', vertical ? 'flex-col' : 'flex-wrap')}>
			{items.map((item) => (
				<LegendEntry key={item.binding.id} item={item} vertical={vertical} />
			))}
		</ul>
	);
}

function LegendEntry({ item, vertical }: { item: LegendItem; vertical: boolean }) {
	const { binding } = item;
	const widget = use(WidgetBindingsContext);
	const { ref } = useBindingDrag(binding, { orientation: vertical ? 'vertical' : 'horizontal' });
	return (
		<li
			ref={ref}
			className={cn(
				'flex min-w-0 cursor-grab items-center gap-1.5 select-none',
				item.dimmed && !binding.hidden && 'opacity-50',
			)}
			// Right-clicking the item offers to remove its binding, middle-clicking removes it
			data-binding-id={binding.id}
		>
			{/* Hidden bindings show a hollow swatch, unlike dimmed ones that just have no value */}
			<button
				type="button"
				className="-m-1 flex shrink-0 cursor-pointer rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={`${binding.hidden ? 'Show' : 'Hide'} ${binding.name}`}
				aria-pressed={!binding.hidden}
				onClick={() => widget?.toggleHidden(binding.id)}
			>
				{item.icon === undefined ? (
					<span
						className="size-2.5 rounded-full border-2"
						style={{ borderColor: item.color, background: binding.hidden ? undefined : item.color }}
					/>
				) : (
					<span className={cn('flex', binding.hidden && 'opacity-40')}>{item.icon}</span>
				)}
			</button>
			<span className={cn('truncate font-mono', binding.hidden && 'text-muted-foreground')}>
				<EntryName name={binding.name} />
			</span>
			{binding.roleLabel !== undefined &&
				(binding.roles.length > 1 ? (
					<RolePicker binding={binding} onPick={(role) => widget?.setRole(binding.id, role)} />
				) : (
					<span className="shrink-0 text-muted-foreground">{binding.roleLabel}</span>
				))}
			{item.note !== undefined && <span className="text-muted-foreground">{item.note}</span>}
			{item.error !== undefined && <span className="text-destructive-foreground">{item.error}</span>}
		</li>
	);
}

/** The binding's role, which opens a menu of the entry's other roles */
function RolePicker({ binding, onPick }: { binding: WidgetBinding; onPick: (role: string) => void }) {
	return (
		<Menu>
			<MenuTrigger
				className="-mx-1 flex shrink-0 cursor-pointer items-center gap-0.5 rounded-sm px-1 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-accent-foreground"
				aria-label={`Draw ${binding.name} as`}
			>
				{binding.roleLabel}
				<ChevronDownIcon className="size-3" />
			</MenuTrigger>
			<MenuPopup align="start">
				<MenuRadioGroup value={binding.role?.id} onValueChange={(role: string) => onPick(role)}>
					{binding.roles.map((role) => (
						<MenuRadioItem key={role.id} value={role.id}>
							{role.label}
						</MenuRadioItem>
					))}
				</MenuRadioGroup>
			</MenuPopup>
		</Menu>
	);
}
