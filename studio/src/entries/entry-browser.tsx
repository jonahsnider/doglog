import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Layout } from '@astryxdesign/core/Layout';
import {
	colorVars,
	durationVars,
	easeVars,
	fontWeightVars,
	radiusVars,
	sizeVars,
	spacingVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import PanelRightOpenIcon from 'lucide-react/icons/panel-right-open';
import XIcon from 'lucide-react/icons/x';
import { useRef } from 'react';
import { Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { ToggleButton } from '@/entries/entry-browser-toggle';
import { EntryTree } from '@/entries/entry-browser-tree';
import { type EditedWidget, useEditedWidget } from '@/entries/edited-widget';
import { TooltipLabel } from '@/components/tooltip-label';
import { shortcuts } from '@/commands/commands';
import { useMobileLayout } from '@/lib/mobile-layout';
import { useSwipeToClose } from '@/hooks/use-swipe-to-close';
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
import { entryBrowserMarker } from './markers.stylex';
import * as z from 'zod';

const styles = stylex.create({
	// Sits in the app header without taking space from the dashboard's panels, centered in its 48px like the sidebar toggle
	mobileToggle: {
		position: 'fixed',
		insetInlineEnd: spacingVars['--spacing-2'],
		top: `calc((48px - ${sizeVars['--size-element-lg']}) / 2)`,
		zIndex: 30,
	},
	// The tree scrolls its rows itself, under its search box
	mobileContent: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		minHeight: 0,
	},
	// As wide as the collapsed sidebar, with the toggle centered like its toggle and where it is in the header below, so it
	// doesn't move when toggled
	collapsed: {
		flexShrink: 0,
		marginInlineStart: spacingVars['--spacing-1-5'],
		paddingInlineStart: spacingVars['--spacing-1-5'],
		paddingInlineEnd: spacingVars['--spacing-3'],
		paddingTop: spacingVars['--spacing-3'],
		paddingBottom: spacingVars['--spacing-1-5'],
	},
	separator: {
		position: 'relative',
		zIndex: 10,
		width: '0.375rem',
		outline: 'none',
		'::before': {
			content: "''",
			position: 'absolute',
			insetInline: '0.125rem',
			insetBlock: spacingVars['--spacing-1'],
			borderRadius: radiusVars['--radius-full'],
			backgroundColor: {
				default: null,
				':focus-visible': 'var(--focus-outline-color)',
				':is([data-separator=active])': 'var(--focus-outline-color)',
				':is([data-separator=hover])': 'var(--focus-outline-color)',
			},
			transitionProperty: 'background-color',
			transitionDuration: durationVars['--duration-fast'],
			transitionTimingFunction: easeVars['--ease-standard'],
		},
		// Covers the library's 10px hit area so double-clicks land on the separator
		'::after': {
			content: "''",
			position: 'absolute',
			insetBlock: 0,
			insetInline: '-0.125rem',
		},
	},
	browser: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		overflow: 'hidden',
	},
	// The padding lines up the header with the panes and their gap
	header: {
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		height: '2.625rem',
		paddingInlineStart: spacingVars['--spacing-2'],
		paddingInlineEnd: spacingVars['--spacing-3'],
		paddingTop: spacingVars['--spacing-1-5'],
	},
	title: {
		flex: 1,
		fontFamily: typographyVars['--font-family-heading'],
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		fontWeight: fontWeightVars['--font-weight-medium'],
	},
	editingTitle: {
		minWidth: 0,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
	entriesTitle: {
		color: colorVars['--color-text-secondary'],
	},
});

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
	const drawerRef = useRef<HTMLDialogElement>(null);
	useSwipeToClose(drawerRef, { isOpen: mobile && open, side: 'end', onClose: () => setEntryBrowserOpen(false) });
	// Video export mode keeps the dashboard it previews as it is
	const exporting = useVideoExport() !== undefined;

	if (mobile) {
		const title = edited ? `Editing ${edited.type.name}` : 'Entry browser';
		return (
			<DashboardIdContext value={dashboard.id}>
				<IconButton
					label="Show entry browser"
					icon={<PanelRightOpenIcon />}
					variant="ghost"
					size="lg"
					xstyle={styles.mobileToggle}
					onClick={() => setEntryBrowserOpen(true)}
				/>
				<Drawer
					ref={drawerRef}
					isOpen={open}
					onOpenChange={setEntryBrowserOpen}
					label={title}
					experimental={{ isFullWidthOnMobile: true }}
				>
					<Layout
						header={<DrawerHeader title={title} onOpenChange={setEntryBrowserOpen} />}
						content={
							<div {...stylex.props(styles.mobileContent)}>
								<EntryTree edited={edited} />
							</div>
						}
					/>
				</Drawer>
			</DashboardIdContext>
		);
	}

	if (!open) {
		return (
			<aside aria-label="Entry browser" inert={exporting} {...stylex.props(styles.collapsed)}>
				<ToggleButton open={false} />
			</aside>
		);
	}

	const separator = stylex.props(styles.separator);
	return (
		<DashboardIdContext value={dashboard.id}>
			<Separator
				aria-label="Resize entry browser"
				disabled={exporting}
				className={`${separator.className} capture-invisible`}
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
				<aside aria-label="Entry browser" inert={exporting} {...stylex.props(entryBrowserMarker, styles.browser)}>
					<EntryBrowserHeader edited={edited} />
					<EntryTree edited={edited} />
				</aside>
			</Panel>
		</DashboardIdContext>
	);
}

function EntryBrowserHeader({ edited }: { edited: EditedWidget | undefined }) {
	return (
		<div {...dragRegion} {...stylex.props(styles.header)}>
			{edited ? (
				<>
					<h2 {...stylex.props(styles.title, styles.editingTitle)}>Editing {edited.type.name}</h2>
					<Tooltip content={<TooltipLabel label="Stop editing" shortcut="Escape" />}>
						<IconButton label="Stop editing" icon={<XIcon />} variant="ghost" size="sm" onClick={stopEditing} />
					</Tooltip>
				</>
			) : (
				<>
					<h2 {...stylex.props(styles.title, styles.entriesTitle)}>Entries</h2>
					<ToggleButton open />
				</>
			)}
		</div>
	);
}
