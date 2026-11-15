import {
	BinaryIcon,
	BoxIcon,
	BoxesIcon,
	BracesIcon,
	HashIcon,
	ListChecksIcon,
	ListIcon,
	ListOrderedIcon,
	type LucideIcon,
	ToggleRightIcon,
	TypeIcon,
} from 'lucide-react';
import type { TooltipPrimitive } from '@/components/ui/tooltip';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { type EntryKind, getEntryKind } from '@/data/samples';

/**
 * One tooltip shared by many marks, so long lists don't render a tooltip per row.
 * Create one with `TooltipCreateHandle()` and render it with `MarkTooltip`.
 */
export type MarkTooltipHandle = TooltipPrimitive.Handle<string>;

export function MarkTooltip({ handle }: { handle: MarkTooltipHandle }) {
	return <Tooltip handle={handle}>{({ payload }) => <TooltipPopup>{payload}</TooltipPopup>}</Tooltip>;
}

const kindIcons: Record<EntryKind, LucideIcon> = {
	number: HashIcon,
	boolean: ToggleRightIcon,
	string: TypeIcon,
	struct: BoxIcon,
	'number[]': ListOrderedIcon,
	'boolean[]': ListChecksIcon,
	'string[]': ListIcon,
	'struct[]': BoxesIcon,
	unsupported: BinaryIcon,
};

/** Icon for an entry type, ex. `#` for `int64` */
export function EntryTypeIcon({ type, className }: { type: string; className?: string | undefined }) {
	const Icon = type === 'json' ? BracesIcon : kindIcons[getEntryKind(type)];
	return <Icon aria-hidden className={className} />;
}

/** Compact icon for an entry type, with the full type in a tooltip */
export function TypeMark({ type, tooltip }: { type: string; tooltip: MarkTooltipHandle }) {
	return (
		<TooltipTrigger
			handle={tooltip}
			payload={type}
			render={
				<span
					role="img"
					aria-label={`Type: ${type}`}
					className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
				/>
			}
		>
			<EntryTypeIcon type={type} className="size-3.5" />
		</TooltipTrigger>
	);
}
