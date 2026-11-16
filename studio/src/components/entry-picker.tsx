import { SearchIcon, Settings2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox';
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { useEntries } from '@/data/data-store';
import { formatEntryType } from '@/data/samples';
import { matchRanges, searchEntries } from '@/entry-search';
import { acceptsEntry, type WidgetType } from '@/widgets/widget-type';
import { EntryName } from '@/components/entry-name';
import { MarqueeText } from '@/components/marquee-text';

/** Few enough items to fit without scrolling, searching narrows the list down */
const browseLimit = 10;
const searchLimit = 20;

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
			{/* Padded like a menu, items have their own padding so their highlight nearly reaches the edges */}
			<PopoverPopup align="end" className="w-96 *:data-[slot=popover-viewport]:p-1">
				<PopoverTitle className="px-2 pt-2 pb-2 text-sm">Entries</PopoverTitle>
				<EntryPicker {...props} />
			</PopoverPopup>
		</Popover>
	);
}

function EntryPicker({ type, entryNames, onEntryNamesChange }: EntryPickerProps) {
	const entries = useEntries();
	const [query, setQuery] = useState('');
	// Bound entries are listed first while browsing so the menu shows what's bound. Read when the search changes rather
	// than on every change so items don't jump around as they're toggled.
	const [pinned, setPinned] = useState(() => new Set(entryNames));

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
	const matches = useMemo(() => {
		if (search) {
			return search.names;
		}
		const available = new Set(items);
		return [
			// In the order they're shown in the widget
			...[...pinned].filter((name) => available.has(name)),
			...items.filter((name) => !pinned.has(name)),
		];
	}, [search, items, pinned]);
	// Every bound entry fits while browsing, even past the limit
	const limit = search ? searchLimit : Math.max(browseLimit, pinned.size);
	const hidden = matches.length - limit;

	return (
		<Combobox
			items={items}
			filteredItems={matches.slice(0, limit)}
			multiple
			inline
			open
			autoHighlight
			value={entryNames}
			onValueChange={onEntryNamesChange}
			inputValue={query}
			onInputValueChange={(newQuery, { reason }) => {
				// Selecting an item clears the search by default, the picker unmounts on close so it never needs clearing
				if (reason === 'input-clear') {
					return;
				}
				setQuery(newQuery);
				setPinned(new Set(entryNames));
			}}
		>
			<ComboboxInput
				aria-label="Search entries"
				placeholder="Search entries"
				startAddon={<SearchIcon />}
				showTrigger={false}
				autoFocus
			/>
			<ComboboxEmpty className="mt-1">No matching entries</ComboboxEmpty>
			<ComboboxList className="mt-1 not-empty:p-0">
				{(name: string) => (
					<ComboboxItem key={name} value={name} className="pe-2">
						<span className="flex items-baseline gap-2">
							<MarqueeText className="min-w-0 flex-1 font-mono text-xs">
								<EntryName name={name} ranges={search?.ranges.get(name)} />
							</MarqueeText>
							<span className="shrink-0 text-xs text-muted-foreground">
								{formatEntryType(accepted.get(name)?.type ?? 'No data')}
							</span>
						</span>
					</ComboboxItem>
				)}
			</ComboboxList>
			{hidden > 0 && (
				// Styled like a disabled item, aligned with the items' names
				<p className="flex min-h-8 items-center ps-8 text-sm text-muted-foreground opacity-64 sm:min-h-7">
					{hidden} more
				</p>
			)}
		</Combobox>
	);
}
