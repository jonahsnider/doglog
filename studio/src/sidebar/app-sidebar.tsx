import { useRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTitleBarStrip, useTrafficLights } from '@/desktop/title-bar';
import { useSwipeToOpen } from '@/hooks/use-swipe-to-open';
import { useMotionTransition } from '@/lib/motion';
import { MobileAppSidebar } from '@/sidebar/mobile-app-sidebar';
import { SidebarContext, type SidebarContextProps } from '@/sidebar/sidebar-context';
import { SidebarItems } from '@/sidebar/sidebar-items';
import {
	animateSidebarPeek,
	copyToRail,
	isCollapsing,
	sidebarAnimationStore,
	sidebarCollapsedStore,
	subscribeSidebarToggle,
	toggleSidebarCollapsed,
} from '@/sidebar/sidebar';
import { TitleBar } from '@/sidebar/title-bar';
import './app-sidebar.css';

const peekDelay = 300;
/** Keeps the peeking sidebar open while the pointer is over a popup, renaming a dashboard, or dragging one */
const keepPeekingSelector = '[aria-expanded="true"], [data-menu-open], input:focus, [data-dnd-dragging]';

export function AppSidebar({ mobile, hasEntryBrowser }: { mobile: boolean; hasEntryBrowser: boolean }) {
	return mobile ? <MobileAppSidebar hasEntryBrowser={hasEntryBrowser} /> : <DesktopAppSidebar />;
}

function DesktopAppSidebar() {
	const collapsed = useSelector(sidebarCollapsedStore);
	const [peeking, setPeeking] = useState(false);
	// Toggling with the keyboard skips the animation, clicking and peeking keep it
	const [animated, setAnimated] = useState(true);
	const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	/** Whether the last press on the sidebar was without a mouse */
	const touchPress = useRef(false);
	const router = useRouter();
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
	const swipeRail = useSwipeToOpen(
		!STUDIO_DESKTOP && iconLayout
			? (dx) => {
					if (dx > 0) {
						peek();
					}
				}
			: undefined,
		// Touch can't hover, so tapping the rail outside its buttons peeks instead.
		iconLayout ? peek : undefined,
	);
	const unpeek = useEffectEvent(() => {
		// Refresh the page and dashboard selection under the sliding sidebar. The rest of the footer and the header
		// show more while peeking than in the rail, so keep those copies from when peeking started.
		copyToRail(railCopyRef.current!, contentRef.current!, '[data-sidebar="content"]', '[data-settings-menu]');
		setPeeking(false);
		animateSidebarPeek(false);
	});
	const toggleWithoutAnimation = useEffectEvent(() => toggle(false));
	useEffect(() => subscribeSidebarToggle(toggleWithoutAnimation), []);

	// A finger doesn't leave the sidebar after tapping a page or dashboard in it, so it stops peeking to show it
	const unpeekAfterTap = useEffectEvent(() => {
		if (peeking && touchPress.current) {
			unpeek();
		}
	});
	useEffect(
		() =>
			router.subscribe('onResolved', ({ pathChanged }) => {
				if (pathChanged) {
					unpeekAfterTap();
				}
			}),
		[router],
	);

	// Also peeks once it's the rail under a pointer that stays still, like after collapsing it with the keyboard
	// Taps leave `:hover` on what they tapped, which doesn't mean a finger is over it
	const peekIfHovered = useEffectEvent(() =>
		!touchPress.current && contentRef.current!.parentElement!.matches(':hover') ? peek() : cancelPeek(),
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
				// A finger also leaves the page whenever it lifts
				(event.type === 'pointerleave' && event.pointerType === 'touch') ||
				(event.target instanceof Node && container.contains(event.target)) ||
				container.querySelector(keepPeekingSelector)
			) {
				return;
			}

			unpeek();
		};

		// Pointer downs for taps, which don't move
		document.addEventListener('pointerdown', hideOnPointerExit);
		document.addEventListener('pointermove', hideOnPointerExit);
		document.documentElement.addEventListener('pointerleave', hideOnPointerExit);
		return () => {
			document.removeEventListener('pointerdown', hideOnPointerExit);
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
			<div
				ref={containerRef}
				data-sidebar-frame=""
				data-collapsed={collapsed ? '' : undefined}
				data-strip={strip ? '' : undefined}
				data-animation={animation}
			>
				<TitleBar collapsed={collapsed} iconOnly={iconOnly} onToggle={() => toggle(!reduceMotion)} />
				<div
					{...swipeRail}
					data-sidebar="sidebar"
					data-collapsible={iconLayout ? 'icon' : undefined}
					data-peeking={collapsed && peeking ? '' : undefined}
					data-icon-only={iconOnly ? '' : undefined}
					data-instant={animated ? undefined : ''}
					// On moves instead of entering, so it also peeks after collapsing under the pointer. Not over its portaled popups.
					onPointerMove={(event) => {
						const overSidebar = event.target instanceof Node && event.currentTarget.contains(event.target);
						if (overSidebar && iconLayout && showTimer.current === undefined && event.pointerType !== 'touch') {
							showTimer.current = setTimeout(peek, peekDelay);
						}
					}}
					onPointerLeave={cancelPeek}
					onPointerDownCapture={(event) => {
						touchPress.current = event.pointerType !== 'mouse';
					}}
				>
					<div data-sidebar-surface="" />
					<div ref={contentRef} data-sidebar-content="">
						<SidebarItems
							// Leaves room for the title bar, which is above the sidebar when it has its own strip
							belowTitleBar={!strip}
							expanded={!iconLayout}
							closing={iconOnly && !iconLayout}
							onShow={peek}
						/>
					</div>
				</div>
				<div ref={railCopyRef} aria-hidden inert data-sidebar="rail-copy" data-collapsible="icon" />
			</div>
		</SidebarContext>
	);
}
