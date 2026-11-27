import { LinkProvider } from '@astryxdesign/core/Link';
import { colorVars, durationVars, easeVars, radiusVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { Outlet, createRootRoute, useMatchRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { useGlobalShortcuts } from '@/commands/app-commands';
import { AppSidebar } from '@/sidebar/app-sidebar';
import { useVideoExport } from '@/desktop/video-export';
import { CloudProvider } from '@/cloud/cloud-background';
import { CommandPaletteDialog } from '@/commands/command-palette';
import { KeyboardShortcutsDialog } from '@/commands/keyboard-shortcuts-dialog';
import { AboutDialog } from '@/components/about-dialog';
import { DragProvider } from '@/components/drag-provider';
import { OpenLogUrlDialog } from '@/components/open-log-url-dialog';
import { RouterLink } from '@/components/router-link';
import { LogDropOverlay } from '@/components/log-drop-overlay';
import { Toasts } from '@/components/toasts';
import { useMobileLayout } from '@/lib/mobile-layout';
import { useTitleBarStrip } from '@/desktop/title-bar';
import { sidebarAnimationStore } from '@/sidebar/sidebar';
import { TimelineBar } from '@/timeline/timeline-bar';
import { useWindowTitle } from '@/window-title';

const styles = stylex.create({
	frame: {
		'--sidebar-width': '17.25rem',
		'--sidebar-width-icon': '2.625rem',
		display: 'flex',
		flexDirection: 'column',
		height: '100svh',
		// Keeps content out of the notch and Dynamic Island, which the background still fills. Panes reach behind the home
		// indicator like a native app's content, the timeline's controls stay above it.
		paddingTop: 'env(safe-area-inset-top)',
		paddingRight: 'env(safe-area-inset-right)',
		paddingLeft: 'env(safe-area-inset-left)',
		backgroundColor: colorVars['--color-background-body'],
	},
	mobileFrame: {
		height: '100dvh',
	},
	// Gives iOS an opaque top edge to extend into the status bar instead of blurring over the app
	webFrame: {
		position: {
			default: null,
			'@media (display-mode: standalone)': { '@supports (-webkit-touch-callout: none)': 'sticky' },
		},
		top: { default: null, '@media (display-mode: standalone)': { '@supports (-webkit-touch-callout: none)': 0 } },
	},
	body: {
		display: 'flex',
		flex: 1,
		minHeight: 0,
	},
	mobileBody: {
		flexDirection: 'column',
	},
	contents: {
		display: 'contents',
	},
	main: {
		position: 'relative',
		display: 'flex',
		flex: 1,
		flexDirection: 'column',
		width: '100%',
		minWidth: 0,
		overflow: 'hidden',
		// Overlays opened with nothing focused, ex. the command palette from its shortcut, return focus here when they
		// close, and a ring around the whole page doesn't show where anything is
		outline: 'none',
	},
	// Pages have a gap around them, dashboards have it inside
	page: {
		margin: '0.375rem',
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-surface'],
	},
	mobilePanes: {
		minHeight: 0,
		paddingInlineEnd: '0.375rem',
	},
	mobilePage: {
		width: 'auto',
		minHeight: 0,
	},
	// Below the title bar's strip, lined up with the rail
	belowStripPanes: {
		marginTop: '2.25rem',
	},
	belowStripPage: {
		marginTop: '2.625rem',
	},
	// Moves below the strip before the sidebar collapses, and back up after it expands
	animated: {
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionProperty: 'margin',
		transitionTimingFunction: easeVars['--ease-move'],
	},
});

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	useGlobalShortcuts();
	useWindowTitle();
	const matchRoute = useMatchRoute();
	const dashboard = matchRoute({ to: '/dashboards/$dashboardId' }) !== false;
	// Dashboards and Tuning lay out their own panes and entry browser on the frame, other pages are one container
	const panes = dashboard || matchRoute({ to: '/tuning' }) !== false;
	const strip = useTitleBarStrip();
	const animation = useSelector(sidebarAnimationStore);
	const exporting = useVideoExport() !== undefined;
	const mobile = useMobileLayout();

	return (
		<LinkProvider component={RouterLink}>
			<CloudProvider>
				{/* Wraps the whole app, so dashboards and panes can be dragged between the sidebar and the main area */}
				<DragProvider>
					<div
						data-app-frame=""
						{...stylex.props(styles.frame, mobile && styles.mobileFrame, !STUDIO_DESKTOP && styles.webFrame)}
					>
						<div {...stylex.props(styles.body, mobile && styles.mobileBody)}>
							<div inert={exporting} {...stylex.props(styles.contents)}>
								<AppSidebar mobile={mobile} hasEntryBrowser={panes} />
							</div>
							<main
								{...stylex.props(
									styles.main,
									!panes && styles.page,
									mobile && (panes ? styles.mobilePanes : styles.mobilePage),
									strip && (panes ? styles.belowStripPanes : styles.belowStripPage),
									animation !== undefined && styles.animated,
								)}
							>
								<Outlet />
							</main>
						</div>
						{dashboard && !exporting && <TimelineBar />}
					</div>
				</DragProvider>
				<LogDropOverlay />
				<AboutDialog />
				<OpenLogUrlDialog />
				<KeyboardShortcutsDialog />
				<CommandPaletteDialog />
				<Toasts />
			</CloudProvider>
		</LinkProvider>
	);
}
