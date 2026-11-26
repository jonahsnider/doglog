import { CommandPalette, CommandPaletteInput, useCommandPaletteContext } from '@astryxdesign/core/CommandPalette';
import { Token } from '@astryxdesign/core/Token';
import { colorVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import type { SearchSource } from '@astryxdesign/core/Typeahead';
import * as stylex from '@stylexjs/stylex';
import { useRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { go } from 'fuzzysort';
import CheckIcon from 'lucide-react/icons/check';
import { useEffect, useRef, useState } from 'react';
import { commandPaletteOpen } from '@/commands/command-palette-handle';
import { HighlightedText } from '@/components/highlighted-text';
import { Shortcut } from '@/components/shortcut';
import { commandItems, dashboardItems, type PaletteItem, recentLogItems, widgetItems } from '@/commands/palette-items';
import { useDashboards } from '@/dashboards/dashboards';
import { useRecentLogHandles, useRecentLogs } from '@/data/recent-logs';
import { matchRanges } from '@/entries/search';
import { useMobileLayout } from '@/lib/mobile-layout';
import { useBindingSources } from '@/widgets/source-entries';
import './command-palette.css';

/** Items listed after choosing one with `items`, ex. an option's choices */
interface Page {
	/** The chosen item's label, which the search box asks for, ex. `Orientation…` */
	label: string;
	/** What its items change, shown above the search box */
	target: PaletteItem['target'];
	items: () => PaletteItem[];
}

const styles = stylex.create({
	icon: {
		flexShrink: 0,
		width: 16,
		height: 16,
		color: colorVars['--color-icon-secondary'],
	},
	// Chips don't size their icons, this matches the items' icons
	targetIcon: {
		flexShrink: 0,
		width: 16,
		height: 16,
	},
	secondary: {
		color: colorVars['--color-text-secondary'],
	},
	detail: {
		flexShrink: 0,
		color: colorVars['--color-text-secondary'],
	},
	page: {
		display: 'flex',
		paddingInline: spacingVars['--spacing-3'],
		paddingBlockStart: spacingVars['--spacing-3'],
	},
	label: {
		minWidth: 0,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
	// Pushes the shortcut and kind to the end
	shortcut: {
		display: 'flex',
		flexShrink: 0,
		marginInlineStart: 'auto',
	},
	// Wide enough for the longest kind, so the shortcuts beside them line up
	kind: {
		flexShrink: 0,
		minWidth: '4.5rem',
		textAlign: 'end',
		color: colorVars['--color-text-secondary'],
	},
});

/** The text an item is found by, its label after its parent's */
function searchText(item: PaletteItem): string {
	return item.parent === undefined ? item.label : `${item.parent} › ${item.label}`;
}

/** The items with every item listed under them, so searching finds an option's choices without choosing the option */
function withNested(items: readonly PaletteItem[]): PaletteItem[] {
	return items.flatMap((item) => [
		item,
		// Items are made for each search, so they're changed in place
		...(item.items
			? withNested(item.items().map((nested) => Object.assign(nested, { parent: searchText(item) })))
			: []),
	]);
}

function search(items: readonly PaletteItem[], query: string): PaletteItem[] {
	const results = go(query.trim(), withNested(items), {
		keys: [searchText, (item) => item.keywords?.join(' ') ?? ''],
		threshold: 0,
	});
	return results.map((result) => {
		const indexes = result[0]?.indexes ?? [];
		return Object.assign(result.obj, { ranges: indexes.length > 0 ? matchRanges(indexes) : undefined });
	});
}

/** Pages leave out the kind, which their items share, and mark the current choice instead */
function renderItem(item: PaletteItem, onPage: boolean) {
	const Icon = item.icon;
	const parent = item.parent === undefined ? '' : `${item.parent} › `;
	return (
		<>
			<Icon aria-hidden {...stylex.props(styles.icon)} />
			<span {...stylex.props(styles.label)}>
				{parent && (
					<span {...stylex.props(styles.secondary)}>
						<HighlightedText text={parent} ranges={item.ranges} />
					</span>
				)}
				<HighlightedText text={item.label} ranges={item.ranges} offset={parent.length} />
			</span>
			{item.detail !== undefined && <span {...stylex.props(styles.detail)}>{item.detail}</span>}
			<span {...stylex.props(styles.shortcut)}>
				{item.shortcut !== undefined && <Shortcut hotkey={item.shortcut} />}
			</span>
			{item.checked === true && <CheckIcon aria-hidden {...stylex.props(styles.icon)} />}
			{!onPage && <span {...stylex.props(styles.kind)}>{item.kind}</span>}
		</>
	);
}

/**
 * The search box, below what the page being shown changes. Escape, or Backspace with nothing typed, goes back from a
 * page. Highlights the first result, or a page's current choice, whenever the results change, so Enter runs it without
 * moving to it first.
 */
function PaletteInput({
	page,
	checkedId,
	onBack,
}: {
	page: Page | undefined;
	/** The page's current choice */
	checkedId: string | undefined;
	onBack: () => void;
}) {
	const palette = useCommandPaletteContext();
	const results = palette?.selectableItems ?? [];
	const resultCount = results.length;
	// Until something's typed, the current choice, so Enter keeps it
	const first =
		palette?.search === ''
			? Math.max(
					results.findIndex((item) => item.value === checkedId),
					0,
				)
			: 0;
	const highlightedIndex = palette?.highlightedIndex ?? -1;
	const setHighlightedIndex = palette?.setHighlightedIndex;
	// Each search clears the highlight before its results arrive
	useEffect(() => {
		if (highlightedIndex === -1 && resultCount > 0) {
			setHighlightedIndex?.(first);
		}
	}, [highlightedIndex, resultCount, first, setHighlightedIndex]);

	const back = () => {
		palette?.setSearch('');
		onBack();
	};
	return (
		<>
			{page?.target && (
				<div {...stylex.props(styles.page)}>
					<Token
						label={page.target.label}
						size="md"
						icon={<page.target.icon aria-hidden {...stylex.props(styles.targetIcon)} />}
					/>
				</div>
			)}
			<CommandPaletteInput
				placeholder={page ? `${page.label}…` : 'Search commands, dashboards, and logs…'}
				onKeyDown={(event) => {
					if (page && (event.key === 'Escape' || (event.key === 'Backspace' && event.currentTarget.value === ''))) {
						// Keeps the palette open, see `useLayerDismissal()` in Astryx
						event.preventDefault();
						back();
					}
				}}
			/>
		</>
	);
}

/** Searches commands, dashboards, pages, recent logs, and the focused widget's commands, opened with its shortcut or from the sidebar */
export function CommandPaletteDialog() {
	const open = useSelector(commandPaletteOpen);
	const router = useRouter();
	const dashboards = useDashboards();
	const savedPaths = useRecentLogs();
	const handles = useRecentLogHandles();
	const sources = useBindingSources();
	const mobile = useMobileLayout();
	const [pages, setPages] = useState<readonly Page[]>([]);
	const page = pages.at(-1);
	/** The chosen item's action, run once the palette has closed and given focus back */
	const pendingRef = useRef<(() => void) | undefined>(undefined);
	/** Whether the chosen item opened a page, so the palette stays open */
	const openedPageRef = useRef(false);

	// Whether commands can run is read when the palette opens and on each search
	const getItems = (): PaletteItem[] => {
		if (page) {
			return page.items();
		}
		const commandList = commandItems(router);
		return [
			...dashboardItems(router, dashboards),
			...commandList.filter((item) => item.kind === 'Page'),
			...widgetItems(router, sources, mobile),
			...commandList.filter((item) => item.kind !== 'Page'),
			...recentLogItems(savedPaths, handles),
		];
	};
	const source: SearchSource<PaletteItem> = {
		bootstrap: getItems,
		search: (query) => search(getItems(), query),
	};

	// Runs after the dialog's own close, so focus it moves, ex. to the entry search box, isn't taken back
	useEffect(() => {
		if (!open) {
			const run = pendingRef.current;
			pendingRef.current = undefined;
			run?.();
		}
	}, [open]);

	return (
		<CommandPalette
			isOpen={open}
			// Choosing an item closes the palette, unless it opened a page
			onOpenChange={(next) => {
				if (!next && openedPageRef.current) {
					openedPageRef.current = false;
					return;
				}
				if (!next) {
					setPages([]);
				}
				commandPaletteOpen.set(next);
			}}
			searchSource={source}
			label="Command palette"
			className="command-palette"
			maxHeight="var(--command-palette-max-height)"
			// Arrows, Enter, and Escape work like in any other list, so they aren't explained
			footer={false}
			input={
				<PaletteInput
					page={page}
					checkedId={page?.items().find((item) => item.checked === true)?.id}
					onBack={() => setPages((shown) => shown.slice(0, -1))}
				/>
			}
			renderItem={(item) => renderItem(item, page !== undefined)}
			onValueChange={(id) => {
				const chosen = withNested(getItems()).find((item) => item.id === id);
				if (chosen?.items) {
					openedPageRef.current = true;
					setPages((shown) => [
						...shown,
						{ label: chosen.label, target: chosen.target ?? shown.at(-1)?.target, items: chosen.items! },
					]);
				} else {
					pendingRef.current = chosen?.run;
				}
			}}
		/>
	);
}
