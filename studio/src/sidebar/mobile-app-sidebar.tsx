import { IconButton } from '@astryxdesign/core/IconButton';
import { MobileNav } from '@astryxdesign/core/MobileNav';
import { fontWeightVars, spacingVars, typeScaleVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useRouter } from '@tanstack/react-router';
import PanelLeftIcon from 'lucide-react/icons/panel-left';
import { useEffect, useRef, useState } from 'react';
import { setEntryBrowserOpen } from '@/entries/editing';
import { useSwipeToClose } from '@/hooks/use-swipe-to-close';
import { useSwipeToOpen } from '@/hooks/use-swipe-to-open';
import { paneTabsSlot } from '@/lib/mobile-layout';
import { SidebarContext, type SidebarContextProps } from '@/sidebar/sidebar-context';
import { SidebarItems } from '@/sidebar/sidebar-items';
import { subscribeSidebarToggle } from '@/sidebar/sidebar';
import './app-sidebar.css';

const styles = stylex.create({
	// The name and the pane tabs share a cell after the sidebar's button, so they cross-fade in place
	header: {
		display: 'grid',
		flexShrink: 0,
		gridTemplateColumns: 'auto 1fr',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		height: 48,
		paddingInline: `calc(${spacingVars['--spacing-2']} + env(safe-area-inset-left)) calc(${spacingVars['--spacing-2']} + env(safe-area-inset-right))`,
	},
	// The dashboard's pane tabs take the name's place, see `app-sidebar.css`
	name: {
		gridArea: '1 / 2',
		justifySelf: 'start',
		fontFamily: typographyVars['--font-family-heading'],
		fontSize: typeScaleVars['--text-label-size'],
		fontWeight: fontWeightVars['--font-weight-semibold'],
	},
	tabs: {
		gridArea: '1 / 2',
		display: 'flex',
		minWidth: 0,
	},
	sidebar: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		minHeight: 0,
	},
});

const setPaneTabsSlot = (element: HTMLElement | null) => {
	paneTabsSlot.set(element);
	return () => paneTabsSlot.set(null);
};

/** The phone layout's top bar, and the sidebar it opens as a drawer */
export function MobileAppSidebar({ hasEntryBrowser }: { hasEntryBrowser: boolean }) {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const toggle = () => setOpen((value) => !value);
	const navRef = useRef<HTMLDialogElement>(null);
	const swipeHeader = useSwipeToOpen(
		open
			? undefined
			: (dx, startX) => {
					if (dx > 0 && startX < window.innerWidth / 2) {
						setOpen(true);
					} else if (hasEntryBrowser && dx < 0 && startX > window.innerWidth / 2) {
						setEntryBrowserOpen(true);
					}
				},
	);
	// Also from the scrim beside it
	useSwipeToClose(navRef, {
		isOpen: open,
		side: 'start',
		onClose: () => setOpen(false),
		panel: '.astryx-mobile-nav-drawer',
	});
	useEffect(() => subscribeSidebarToggle(() => setOpen((value) => !value)), []);
	useEffect(
		() =>
			router.subscribe('onResolved', ({ pathChanged }) => {
				if (pathChanged) {
					setOpen(false);
				}
			}),
		[router],
	);

	const context: SidebarContextProps = { collapsed: false, open: true, isMobile: true, toggleSidebar: toggle };
	return (
		<SidebarContext value={context}>
			<header data-mobile-header {...swipeHeader} {...stylex.props(styles.header)}>
				<IconButton
					label="Show sidebar"
					icon={<PanelLeftIcon />}
					variant="ghost"
					size="lg"
					aria-expanded={open}
					onClick={toggle}
				/>
				<span data-mobile-name {...stylex.props(styles.name)}>
					DogLog Studio
				</span>
				<div ref={setPaneTabsSlot} {...stylex.props(styles.tabs)} />
			</header>
			<MobileNav ref={navRef} isOpen={open} onOpenChange={setOpen} side="start" header="DogLog Studio" label="Sidebar">
				<div data-sidebar="sidebar" {...stylex.props(styles.sidebar)}>
					<SidebarItems />
				</div>
			</MobileNav>
		</SidebarContext>
	);
}
