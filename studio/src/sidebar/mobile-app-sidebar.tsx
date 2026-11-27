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
import { SidebarContext, type SidebarContextProps } from '@/sidebar/sidebar-context';
import { SidebarItems } from '@/sidebar/sidebar-items';
import { subscribeSidebarToggle } from '@/sidebar/sidebar';

const styles = stylex.create({
	header: {
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		height: 48,
		paddingInline: spacingVars['--spacing-2'],
	},
	name: {
		fontFamily: typographyVars['--font-family-heading'],
		fontSize: typeScaleVars['--text-label-size'],
		fontWeight: fontWeightVars['--font-weight-semibold'],
	},
	sidebar: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		minHeight: 0,
	},
});

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
			<header {...swipeHeader} {...stylex.props(styles.header)}>
				<IconButton
					label="Show sidebar"
					icon={<PanelLeftIcon />}
					variant="ghost"
					size="lg"
					aria-expanded={open}
					onClick={toggle}
				/>
				<span {...stylex.props(styles.name)}>DogLog Studio</span>
			</header>
			<MobileNav ref={navRef} isOpen={open} onOpenChange={setOpen} side="start" header="DogLog Studio" label="Sidebar">
				<div data-sidebar="sidebar" {...stylex.props(styles.sidebar)}>
					<SidebarItems />
				</div>
			</MobileNav>
		</SidebarContext>
	);
}
