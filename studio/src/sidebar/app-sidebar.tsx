import { useHotkey } from '@tanstack/react-hotkeys';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import FolderSyncIcon from 'lucide-react/icons/folder-sync';
import SettingsIcon from 'lucide-react/icons/settings';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
	Sidebar,
	SidebarContent,
	SidebarContext,
	type SidebarContextProps,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { AppSidebarFooter } from '@/sidebar/app-sidebar-footer';
import { SourceControl } from '@/sidebar/source-control';
import { ShortcutHint } from '@/sidebar/shortcut-hint';
import { SidebarDashboards } from '@/sidebar/sidebar-dashboards';
import { TooltipLabel } from '@/components/tooltip-label';
import { shortcuts } from '@/commands/commands';
import { cn } from '@/lib/utils';
import { useTitleBarStrip, useTrafficLights } from '@/desktop/title-bar';
import {
	animateSidebarPeek,
	copyToRail,
	isCollapsing,
	sidebarAnimationStore,
	sidebarCollapsedStore,
	toggleSidebarCollapsed,
} from '@/sidebar/sidebar';
import { useMotionTransition } from '@/lib/motion';
import { TitleBar } from '@/sidebar/title-bar';

const peekDelay = 300;
/** Keeps the peeking sidebar open while the pointer is over a popup, renaming a dashboard, or dragging one */
const keepPeekingSelector =
	':is([data-slot="menu-trigger"], [data-slot="context-menu-trigger"], [data-slot="dialog-trigger"])[data-popup-open], input:focus, [data-dnd-dragging]';

function noop(): void {}

export function AppSidebar() {
	const matchRoute = useMatchRoute();
	const collapsed = useSelector(sidebarCollapsedStore);
	const [peeking, setPeeking] = useState(false);
	// Toggling with the keyboard skips the animation, clicking and peeking keep it
	const [animated, setAnimated] = useState(true);
	const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const railCopyRef = useRef<HTMLDivElement>(null);
	const iconOnly = collapsed && !peeking;
	const strip = useTitleBarStrip();
	const trafficLights = useTrafficLights();
	const animation = useSelector(sidebarAnimationStore);
	// Collapsing is expanding in reverse: the sidebar keeps its full layout while it shrinks, clipped like when it expands,
	// and only shows icons once it's done. Peeking ends the same way, but slides out at its full width instead of shrinking.
	const iconLayout = iconOnly && !isCollapsing(animation);
	// Only read to skip the animation's steps when the system reduces motion
	const reduceMotion = useMotionTransition({ duration: 0.2 }).duration === 0;

	useEffect(() => {
		if (animation !== 'collapse' && animation !== 'unpeek' && animation !== 'peek') {
			return undefined;
		}

		// Keep the full layout until the sidebar finishes resizing or sliding. A timer can expire before the browser
		// finishes the transitions, especially if layout starts late after moving below the macOS title bar.
		const transitions = containerRef
			.current!.getAnimations({ subtree: true })
			.filter((transition) => transition instanceof CSSTransition);
		let stopped = false;
		void Promise.allSettled(transitions.map((transition) => transition.finished)).then(() => {
			if (!stopped && sidebarAnimationStore.get() === animation) {
				sidebarAnimationStore.set(undefined);
			}
			return undefined;
		});
		return () => {
			stopped = true;
		};
	}, [animation]);

	const cancelPeek = () => {
		clearTimeout(showTimer.current);
		showTimer.current = undefined;
	};

	const toggle = (animate: boolean) => {
		cancelPeek();
		setPeeking(false);
		setAnimated(animate);
		toggleSidebarCollapsed(animate, trafficLights);
	};

	const peek = () => {
		cancelPeek();
		// The rail stays put while the sidebar slides over it from the window's edge, so it's copied as it is before the
		// sidebar switches to its full layout. A peek starting again while the last one slides out keeps the copy it has.
		const content = contentRef.current!;
		if (content.parentElement!.dataset['collapsible'] === 'icon') {
			copyToRail(railCopyRef.current!, content);
		}
		setAnimated(true);
		setPeeking(true);
		animateSidebarPeek(true);
	};
	useHotkey(shortcuts.toggleSidebar, () => toggle(false), { requireReset: true });

	// Also peeks once it's the rail under a pointer that stays still, like after collapsing it with the keyboard
	const peekIfHovered = useEffectEvent(() =>
		contentRef.current!.parentElement!.matches(':hover') ? peek() : cancelPeek(),
	);
	useEffect(() => {
		if (iconLayout) {
			showTimer.current = setTimeout(peekIfHovered, peekDelay);
		}
		return () => clearTimeout(showTimer.current);
	}, [iconLayout]);

	// Check pointer moves since menus are rendered outside the sidebar, and pointerleave for exits from the window
	useEffect(() => {
		if (!peeking) {
			return undefined;
		}

		const hideOnPointerExit = (event: PointerEvent) => {
			const container = containerRef.current;
			if (
				!container ||
				(event.target instanceof Node && container.contains(event.target)) ||
				container.querySelector(keepPeekingSelector)
			) {
				return;
			}

			// The sidebar slides out over the copy, so its pages and dashboards are copied again, like a new selection. The
			// header and footer show more while peeking than in the rail, so they keep the copy from when peeking started.
			copyToRail(railCopyRef.current!, contentRef.current!, '[data-sidebar="content"]');
			setPeeking(false);
			animateSidebarPeek(false);
		};

		document.addEventListener('pointermove', hideOnPointerExit);
		document.documentElement.addEventListener('pointerleave', hideOnPointerExit);
		return () => {
			document.removeEventListener('pointermove', hideOnPointerExit);
			document.documentElement.removeEventListener('pointerleave', hideOnPointerExit);
		};
	}, [peeking]);

	// Provided directly instead of using `SidebarProvider`, its open state is saved with `cookieStore`, which WebKit lacks
	const context: SidebarContextProps = {
		state: iconLayout ? 'collapsed' : 'expanded',
		open: !collapsed,
		setOpen: (open) => sidebarCollapsedStore.set(!open),
		openMobile: false,
		setOpenMobile: noop,
		isMobile: false,
		toggleSidebar: () => toggle(!reduceMotion),
	};

	return (
		<SidebarContext value={context}>
			{/* Reserves the sidebar's space in the layout, so peeking doesn't resize the dashboard */}
			<div
				ref={containerRef}
				className={cn(
					'relative shrink-0',
					collapsed ? 'w-(--sidebar-width-icon)' : 'w-(--sidebar-width)',
					// Resizes the main area along with the sidebar, like the timeline sliding up resizes the panes
					'transition-[width] duration-200 motion-reduce:transition-none',
					// The main area moves below the title bar's strip before the sidebar collapses
					'data-[animation=enter-strip]:w-(--sidebar-width) not-data-animation:transition-none',
				)}
				data-animation={animation}
			>
				<TitleBar collapsed={collapsed} iconOnly={iconOnly} onToggle={() => toggle(!reduceMotion)} />
				<Sidebar
					collapsible="none"
					data-collapsible={iconLayout ? 'icon' : undefined}
					data-peeking={collapsed && peeking ? '' : undefined}
					className={cn(
						// Transparent on the frame, so it shows the window's backdrop through it when the frame is frosted. Its surface for peeking is below.
						'group peer absolute start-0 bottom-0 z-20 overflow-hidden bg-transparent duration-200 motion-reduce:transition-none',
						// Only expanding and collapsing resize it, peeking slides it at its full width by `--peek`, set here since WebKit
						// doesn't resize the container while it changes there
						'[--peek:0] data-peeking:[--peek:1]',
						'transition-[box-shadow,--peek] in-data-[animation=collapse]:transition-[width,box-shadow,--peek] in-data-[animation=expand]:transition-[width,box-shadow,--peek]',
						// Below the title bar's strip, lined up with the main area's panes and pages, which have a gap above them
						strip ? 'top-10.5' : 'top-0',
						// Sized by its top and bottom instead of `Sidebar`'s full height, which would push it past the bottom of the window below the strip
						'h-auto',
						// On the frame like the rest of the app's base, rounded for when it peeks over the panes
						'rounded-e-lg',
						iconOnly && 'w-(--sidebar-width-icon) in-data-[animation=unpeek]:w-(--sidebar-width)',
						// Floats over the rail and the panes while it peeks, sliding in from the window's edge. Its shadow fades as it leaves.
						'data-peeking:shadow-lg',
						'data-peeking:translate-x-[calc((var(--peek)-1)*100%)] in-data-[animation=unpeek]:translate-x-[calc((var(--peek)-1)*100%)]',
						// The content is already at its full size, see below
						'[&_[data-sidebar=menu-button]]:transition-none',
						// Its width as it animates, for the menu buttons' corners, see `index.css`. The content is already contained.
						'@container',
						// Stays put until the main area is below the strip, then collapses
						'in-data-[animation=enter-strip]:top-0 in-data-[animation=enter-strip]:w-(--sidebar-width)',
						!animated && 'transition-none',
					)}
					// On moves instead of entering, so it also peeks after collapsing under the pointer. Not over its portaled popups.
					onPointerMove={(event) => {
						const overSidebar = event.target instanceof Node && event.currentTarget.contains(event.target);
						if (overSidebar && iconLayout && showTimer.current === undefined && event.pointerType !== 'touch') {
							showTimer.current = setTimeout(peek, peekDelay);
						}
					}}
					onPointerLeave={cancelPeek}
				>
					{/* Its surface while it floats over the rail and the panes, wiped away behind the panes as it expands from there */}
					<div
						className={cn(
							'pointer-events-none absolute inset-0 -z-10 bg-(--frame) opacity-0',
							'group-data-peeking:opacity-100 in-data-[animation=unpeek]:opacity-100 in-data-[animation=expand]:opacity-100',
							'in-data-[animation=expand]:[clip-path:inset(0_0_0_calc((1-var(--peek))*(var(--sidebar-width)+0.375rem)))]',
						)}
					/>
					{/* Like sliding panes, the content keeps its full width and is clipped, so it isn't laid out again every frame while the sidebar's width animates */}
					<div
						ref={contentRef}
						className="flex h-full w-(--sidebar-width) shrink-0 flex-col contain-strict group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
					>
						<SidebarHeader
							// Leaves room for the title bar, which is above the sidebar when it has its own strip
							// The items stay where they are in the rail below the strip, so they don't move when the sidebar expands
							className={cn(!strip && 'pt-12.5', 'in-data-[animation=enter-strip]:pt-12.5')}
						>
							<SidebarMenu>
								<SourceControl />
							</SidebarMenu>
						</SidebarHeader>
						<SidebarContent>
							<SidebarGroup>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton
											isActive={Boolean(matchRoute({ to: '/logs' }))}
											render={<Link to="/logs" />}
											tooltip={{ children: <TooltipLabel label="Logs" shortcut={shortcuts.logs} /> }}
										>
											<FolderSyncIcon />
											<span>Logs</span>
										</SidebarMenuButton>
										<ShortcutHint shortcut={shortcuts.logs} />
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton
											isActive={Boolean(matchRoute({ to: '/tuning' }))}
											render={<Link to="/tuning" />}
											tooltip={{ children: 'Tuning' }}
										>
											<SlidersHorizontalIcon />
											<span>Tuning</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton
											isActive={Boolean(matchRoute({ to: '/settings' }))}
											render={<Link to="/settings" />}
											tooltip={{ children: <TooltipLabel label="Settings" shortcut={shortcuts.settings} /> }}
										>
											<SettingsIcon />
											<span>Settings</span>
										</SidebarMenuButton>
										<ShortcutHint shortcut={shortcuts.settings} />
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroup>
							<SidebarDashboards />
						</SidebarContent>
						<AppSidebarFooter expanded={!iconLayout} closing={iconOnly && !iconLayout} onShow={peek} />
					</div>
				</Sidebar>
				{/* The rail as it was when peeking started, under the sidebar while it's out, see `peek()` */}
				<div
					ref={railCopyRef}
					aria-hidden
					inert
					data-slot="sidebar-rail-copy"
					data-collapsible="icon"
					className={cn(
						'group pointer-events-none invisible absolute start-0 bottom-0 z-10 w-(--sidebar-width-icon) overflow-hidden text-sidebar-foreground',
						'peer-data-peeking:visible in-data-[animation=unpeek]:visible',
						strip ? 'top-10.5' : 'top-0',
					)}
				/>
			</div>
		</SidebarContext>
	);
}
