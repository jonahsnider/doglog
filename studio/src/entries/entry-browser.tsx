import { useHotkey } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import PanelRightOpenIcon from 'lucide-react/icons/panel-right-open';
import XIcon from 'lucide-react/icons/x';
import { Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { ToggleButton } from '@/entries/entry-browser-toggle';
import { EntryTree } from '@/entries/entry-browser-tree';
import { type EditedWidget, useEditedWidget } from '@/entries/edited-widget';
import { Button } from '@/components/ui/button';
import { Sheet, SheetPopup, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { shortcuts } from '@/commands/commands';
import { useMobileLayout } from '@/lib/mobile-layout';
import type { Dashboard } from '@/dashboards/dashboards';
import { DashboardIdContext } from '@/dashboards/panes';
import { useVideoExport } from '@/desktop/video-export';
import {
	focusEntrySearch,
	getEntryBrowserOpenStore,
	setEntryBrowserOpen,
	stopEditing,
	toggleEntryBrowser,
} from '@/entries/editing';
import { createPersistedAtom } from '@/lib/persisted-store';
import { dragRegion } from '@/desktop/title-bar';
import * as z from 'zod';

const defaultWidthPx = 320;
const widthPxStore = createPersistedAtom('entry-browser-width', z.number().positive(), defaultWidthPx, {
	perWindow: true,
});

export function EntryBrowser({ dashboard }: { dashboard: Dashboard }) {
	const mobile = useMobileLayout();
	const open = useSelector(getEntryBrowserOpenStore(mobile));
	useHotkey(shortcuts.toggleEntryBrowser, toggleEntryBrowser, { requireReset: true });
	useHotkey(shortcuts.searchEntries, focusEntrySearch);
	const edited = useEditedWidget(dashboard);
	useHotkey('Escape', stopEditing, {
		// The mobile sheet handles Escape, including when a nested menu is open.
		enabled: !mobile && edited !== undefined,
		ignoreInputs: false,
		conflictBehavior: 'allow',
	});
	const panelRef = usePanelRef();
	// Video export mode keeps the dashboard it previews as it is
	const exporting = useVideoExport() !== undefined;

	if (mobile) {
		return (
			<DashboardIdContext value={dashboard.id}>
				<Sheet open={open} onOpenChange={setEntryBrowserOpen}>
					{/* Sits in the app header without taking space from the dashboard's panels. */}
					<SheetTrigger
						render={<Button variant="ghost" size="icon-xl" aria-label="Show entry browser" />}
						className="fixed end-2 top-0.5 z-30"
					>
						<PanelRightOpenIcon />
					</SheetTrigger>
					<SheetPopup
						className="w-full max-w-none border-0 bg-sidebar text-sidebar-foreground motion-reduce:transition-none"
						closeProps={{ 'aria-label': edited ? 'Stop editing' : 'Hide entry browser' }}
					>
						<SheetTitle className="flex h-12 shrink-0 items-center ps-3 pe-14 text-base">
							{edited ? `Editing ${edited.type.name}` : 'Entry browser'}
						</SheetTitle>
						<EntryTree edited={edited} />
					</SheetPopup>
				</Sheet>
			</DashboardIdContext>
		);
	}

	if (!open) {
		return (
			// As wide as the collapsed sidebar, with the toggle centered like its toggle and where it is in the header below, so it
			// doesn't move when toggled
			<aside aria-label="Entry browser" inert={exporting} className="ms-1.5 shrink-0 ps-1.5 pe-3 pt-3 pb-1.5">
				<ToggleButton open={false} />
			</aside>
		);
	}

	return (
		<DashboardIdContext value={dashboard.id}>
			<Separator
				aria-label="Resize entry browser"
				disabled={exporting}
				// Covers the library's 10px hit area so double-clicks land on the separator
				className="relative z-10 w-1.5 outline-none before:absolute before:inset-x-0.5 before:inset-y-1 before:rounded-full before:transition-colors after:absolute after:inset-y-0 after:-inset-x-0.5 focus-visible:before:bg-ring data-[separator=active]:before:bg-ring data-[separator=hover]:before:bg-ring capture:before:hidden"
				// The built-in reset would use the saved width
				disableDoubleClick
				onDoubleClick={() => panelRef.current?.resize(defaultWidthPx)}
			/>
			<Panel
				panelRef={panelRef}
				defaultSize={widthPxStore.get()}
				minSize="7rem"
				groupResizeBehavior="preserve-pixel-size"
				// Skip the initial mount, which may be clamped to fit a small window
				onResize={(size, _id, prevSize) => prevSize && widthPxStore.set(size.inPixels)}
			>
				{/* Not selectable, so double-clicking or dragging rows doesn't select their labels */}
				{/* A sidebar like the one on the left, on the frame instead of its own surface */}
				<aside
					aria-label="Entry browser"
					inert={exporting}
					className="group/entry-browser flex h-full flex-col overflow-hidden"
				>
					<EntryBrowserHeader edited={edited} />
					<EntryTree edited={edited} />
				</aside>
			</Panel>
		</DashboardIdContext>
	);
}

function EntryBrowserHeader({ edited }: { edited: EditedWidget | undefined }) {
	return (
		// The padding lines up the header with the panes and their gap.
		<div {...dragRegion} className="flex h-10.5 shrink-0 items-center gap-1 ps-2 pe-3 pt-1.5">
			{edited ? (
				<>
					<h2 className="min-w-0 flex-1 truncate font-heading text-sm font-medium">Editing {edited.type.name}</h2>
					<Tooltip>
						<TooltipTrigger
							render={<Button variant="ghost" size="icon-xs" aria-label="Stop editing" onClick={stopEditing} />}
						>
							<XIcon />
						</TooltipTrigger>
						<TooltipPopup>
							<TooltipLabel label="Stop editing" shortcut="Escape" />
						</TooltipPopup>
					</Tooltip>
				</>
			) : (
				<>
					<h2 className="flex-1 font-heading text-sm font-medium text-muted-foreground">Entries</h2>
					<ToggleButton open />
				</>
			)}
		</div>
	);
}
