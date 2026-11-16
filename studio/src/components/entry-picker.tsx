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
} from '@/components/ui/combobox';
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { useEntries } from '@/data/data-store';
import { formatEntryType } from '@/data/samples';
import { matchRanges, searchEntries } from '@/entry-search';
import { acceptsEntry, type WidgetType } from '@/widgets/widget-type';
import { EntryName } from '@/components/entry-name';

/** Rendering thousands of items is slow, searching narrows the list down */
const itemLimit = 100;

type EntryPickerProps = {
	type: WidgetType;
	entryNames: readonly string[];
	onEntryNamesChange: (entryNames: string[]) => void;
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

function EntryPicker({ type, entryNames, onEntryNamesChange }: EntryPickerProps) {
	const entries = useEntries();
	const [query, setQuery] = useState('');

	const accepted = useMemo(
		() => new Map(entries.filter((entry) => acceptsEntry(type, entry)).map((entry) => [entry.name, entry])),
		[entries, type],
	);
	// Bound entries missing from the source are listed too, so they can be unbound
	const items = useMemo(() => [...new Set([...accepted.keys(), ...entryNames])].toSorted(), [accepted, entryNames]);
	const search = useMemo(() => {
		const results = searchEntries(
			items.map((name) => accepted.get(name) ?? { name }),
			query,
		);
		return (
			results && {
				names: results.map((result) => result.obj.name),
				ranges: new Map(results.map((result) => [result.obj.name, matchRanges(result[0]!.indexes)])),
			}
		);
	}, [items, accepted, query]);
	const matches = search?.names ?? items;

	return (
		<Combobox
			items={items}
			filteredItems={matches.slice(0, itemLimit)}
			multiple
			inline
			open
			autoHighlight
			value={entryNames}
			onValueChange={onEntryNamesChange}
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
									<EntryName name={name} ranges={search?.ranges.get(name)} />
								</span>
								<span className="shrink-0 text-xs text-muted-foreground">
									{formatEntryType(accepted.get(name)?.type ?? 'No data')}
								</span>
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
