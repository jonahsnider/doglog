import { useHotkey } from '@tanstack/react-hotkeys';
import { useRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import PanelLeftIcon from 'lucide-react/icons/panel-left';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { MobileNav } from '@astryxdesign/core/MobileNav';
import { shortcuts } from '@/commands/commands';
import { cn } from '@/lib/utils';
import { useTitleBarStrip, useTrafficLights } from '@/desktop/title-bar';
import { SidebarContext, type SidebarContextProps } from '@/sidebar/sidebar-context';
import { SidebarItems } from '@/sidebar/sidebar-items';
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
const keepPeekingSelector = '[aria-expanded="true"], [data-menu-open], input:focus, [data-dnd-dragging]';

export function AppSidebar({ mobile }: { mobile: boolean }) {
	return mobile ? <MobileAppSidebar /> : <DesktopAppSidebar />;
}

function MobileAppSidebar() {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const toggle = () => setOpen((value) => !value);
	useHotkey(shortcuts.toggleSidebar, toggle, { requireReset: true });
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
			<header className="flex h-12 shrink-0 items-center gap-1 px-2">
				<IconButton
					label="Show sidebar"
					icon={<PanelLeftIcon />}
					variant="ghost"
					size="lg"
					aria-expanded={open}
					onClick={toggle}
				/>
				<span className="font-heading text-sm font-semibold">DogLog Studio</span>
			</header>
			<MobileNav isOpen={open} onOpenChange={setOpen} header="DogLog Studio" label="Sidebar">
				<div data-sidebar="sidebar" className="flex h-full min-h-0 flex-col">
					<SidebarItems />
				</div>
			</MobileNav>
		</SidebarContext>
	);
}

function DesktopAppSidebar() {
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

	const context: SidebarContextProps = {
		collapsed: iconLayout,
		open: !collapsed,
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
				<div
					data-sidebar="sidebar"
					data-collapsible={iconLayout ? 'icon' : undefined}
					data-peeking={collapsed && peeking ? '' : undefined}
					className={cn(
						// Transparent on the frame, so it shows the window's backdrop through it when the frame is frosted. Its surface for peeking is below.
						'group peer absolute start-0 bottom-0 z-20 flex w-(--sidebar-width) flex-col overflow-hidden text-(--color-text-secondary) duration-200 motion-reduce:transition-none',
						// Peeking slides at full width. Animate `--peek` here so WebKit updates the drawer during the transition.
						'[--peek:0] data-peeking:[--peek:1]',
						// Keep the drawer lined up with the panes for the whole slide in and out.
						'data-peeking:bottom-1.5 in-data-[animation=unpeek]:bottom-1.5',
						'transition-[box-shadow,--peek] in-data-[animation=collapse]:transition-[width,box-shadow,--peek] in-data-[animation=expand]:transition-[width,box-shadow,--peek]',
						// Below the title bar's strip, lined up with the main area's panes and pages, which have a gap above them
						strip ? 'top-10.5' : 'top-0',
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
						<SidebarItems
							// Leaves room for the title bar, which is above the sidebar when it has its own strip
							// The items stay where they are in the rail below the strip, so they don't move when the sidebar expands
							belowTitleBar={!strip}
							expanded={!iconLayout}
							closing={iconOnly && !iconLayout}
							onShow={peek}
						/>
					</div>
				</div>
				{/* The rail as it was when peeking started, under the sidebar while it's out, see `peek()` */}
				<div
					ref={railCopyRef}
					aria-hidden
					inert
					data-sidebar="rail-copy"
					data-collapsible="icon"
					className={cn(
						'group pointer-events-none invisible absolute start-0 bottom-0 z-10 w-(--sidebar-width-icon) overflow-hidden text-(--color-text-secondary)',
						'peer-data-peeking:visible in-data-[animation=unpeek]:visible',
						strip ? 'top-10.5' : 'top-0',
					)}
				/>
			</div>
		</SidebarContext>
	);
}
