import BinaryIcon from 'lucide-react/icons/binary';
import BoxIcon from 'lucide-react/icons/box';
import BoxesIcon from 'lucide-react/icons/boxes';
import BracesIcon from 'lucide-react/icons/braces';
import CheckIcon from 'lucide-react/icons/check';
import HashIcon from 'lucide-react/icons/hash';
import ListChecksIcon from 'lucide-react/icons/list-checks';
import ListIcon from 'lucide-react/icons/list';
import ListOrderedIcon from 'lucide-react/icons/list-ordered';
import SplineIcon from 'lucide-react/icons/spline';
import ToggleRightIcon from 'lucide-react/icons/toggle-right';
import TypeIcon from 'lucide-react/icons/type';
import type { LucideIcon } from 'lucide-react/types';
import type { TooltipPrimitive } from '@/components/ui/tooltip';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import type { EntryKind } from '@/data/entry-kind';
import { formatEntryType, getEntryKind } from '@/data/samples';
import { knownGroup } from '@/entries/known-groups';
import { cn } from '@/lib/utils';

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
	mechanism2d: SplineIcon,
	unsupported: BinaryIcon,
};

/** Icon for an entry type, ex. `#` for `int64` */
export function EntryTypeIcon({ type, className }: { type: string; className?: string | undefined }) {
	const Icon = type === 'json' ? BracesIcon : kindIcons[getEntryKind(type)];
	return <Icon aria-hidden className={className} />;
}

/**
 * Compact icon for an entry type, with the full type in a tooltip. `checked` shows a checked checkbox in its place, and
 * `checkable` shows an empty one while its `group/entry-row` is hovered or focused.
 */
export function TypeMark({
	type,
	tooltip,
	checked = false,
	checkable = false,
}: {
	type: string;
	tooltip: MarkTooltipHandle;
	checked?: boolean;
	checkable?: boolean;
}) {
	return (
		<TooltipTrigger
			handle={tooltip}
			payload={formatEntryType(type)}
			render={
				<span
					role="img"
					aria-label={`Type: ${formatEntryType(type)}`}
					className={cn(
						'flex size-4 shrink-0 items-center justify-center',
						checked ? 'rounded-[.25rem] bg-primary text-primary-foreground' : 'text-muted-foreground',
					)}
				/>
			}
		>
			{checked ? (
				<CheckIcon aria-hidden className="size-3" strokeWidth={3} />
			) : (
				<>
					<EntryTypeIcon
						type={type}
						className={cn('size-3.5', checkable && 'group-hover/entry-row:hidden group-focus-visible/entry-row:hidden')}
					/>
					{checkable && (
						<span
							aria-hidden
							className="hidden size-4 rounded-[.25rem] border border-outline group-hover/entry-row:block group-focus-visible/entry-row:block"
						/>
					)}
				</>
			)}
		</TooltipTrigger>
	);
}

/**
 * What the group at `path` is when it's a known group (see `knownGroup()`), at the end of its row where entries show
 * their values, with its name in a tooltip. Renders nothing for other groups.
 */
export function GroupMark({ path, tooltip }: { path: string; tooltip: MarkTooltipHandle }) {
	const group = knownGroup(path);
	if (!group) {
		return null;
	}

	const { name, icon: Icon } = group;
	return (
		<TooltipTrigger
			handle={tooltip}
			payload={name}
			render={
				<span
					role="img"
					aria-label={name}
					className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
				/>
			}
		>
			<Icon aria-hidden className="size-3.5" />
		</TooltipTrigger>
	);
}
