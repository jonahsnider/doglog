import { SearchIcon, Settings2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxFilter,
} from '@/components/ui/combobox';
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { useEntries } from '@/data/data-store';
import { formatEntryType } from '@/data/samples';
import { acceptsEntry, type WidgetType } from '@/widgets/widget-type';
import { EntryName } from '@/components/entry-name';

/** Rendering thousands of items is slow, searching narrows the list down */
const itemLimit = 100;

type EntryPickerProps = {
	type: WidgetType;
	entries: readonly string[];
	onEntriesChange: (entries: string[]) => void;
};

/** The widget options button, opens a searchable picker for binding entries of the widget's accepted kinds */
export function WidgetOptions({
	open,
	onOpenChange,
	...props
}: EntryPickerProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<Tooltip>
				<TooltipTrigger
					render={<PopoverTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Widget options" />} />}
				>
					<Settings2Icon />
				</TooltipTrigger>
				<TooltipPopup>Widget options</TooltipPopup>
			</Tooltip>
			<PopoverPopup align="end" className="w-96">
				<PopoverTitle className="mb-3 text-sm">Entries</PopoverTitle>
				<EntryPicker {...props} />
			</PopoverPopup>
		</Popover>
	);
}

function EntryPicker({ type, entries, onEntriesChange }: EntryPickerProps) {
	const allEntries = useEntries();
	const [query, setQuery] = useState('');
	const { contains } = useComboboxFilter();

	const entryTypes = useMemo(
		() =>
			new Map(
				allEntries
					.filter((entry) => acceptsEntry(type, entry))
					.map((entry) => [entry.name, formatEntryType(entry.type)]),
			),
		[allEntries, type],
	);
	// Bound entries missing from the source are listed too, so they can be unbound
	const items = useMemo(() => [...new Set([...entryTypes.keys(), ...entries])].toSorted(), [entryTypes, entries]);
	const matches = useMemo(() => items.filter((name) => contains(name, query)), [items, query, contains]);

	return (
		<Combobox
			items={items}
			filteredItems={matches.slice(0, itemLimit)}
			multiple
			inline
			open
			autoHighlight
			value={entries}
			onValueChange={onEntriesChange}
			inputValue={query}
			onInputValueChange={setQuery}
		>
			<ComboboxChips startAddon={<SearchIcon />}>
				<ComboboxValue>
					{(names: string[]) =>
						names.map((name) => (
							<ComboboxChip key={name} aria-label={name}>
								<EntryName name={name} />
							</ComboboxChip>
						))
					}
				</ComboboxValue>
				<ComboboxChipsInput aria-label="Search entries" placeholder="Search entries" autoFocus />
			</ComboboxChips>
			<div className="mt-2 flex max-h-72 min-h-0 flex-col">
				<ComboboxEmpty>No matching entries</ComboboxEmpty>
				<ComboboxList>
					{(name: string) => (
						<ComboboxItem key={name} value={name}>
							<span className="flex items-baseline gap-2">
								<span className="min-w-0 flex-1 truncate font-mono text-xs">
									<EntryName name={name} />
								</span>
								<span className="shrink-0 text-xs text-muted-foreground">{entryTypes.get(name) ?? 'No data'}</span>
							</span>
						</ComboboxItem>
					)}
				</ComboboxList>
			</div>
			{matches.length > itemLimit && (
				<p className="mt-2 text-xs text-muted-foreground">
					Showing {itemLimit} of {matches.length} entries, search to find more.
				</p>
			)}
		</Combobox>
	);
}
