import { SparklesIcon, XIcon } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react';
import { Button } from '@/components/ui/button';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { dismissUpdate, useUnseenUpdate } from '@/changelog/changelog';
import { easing, useMotionTransition } from '@/lib/motion';

/**
 * Like Linear, announces the newest product update at the bottom of the sidebar until it's dismissed.
 * The collapsed sidebar shows an icon instead, which calls `onShow` to show the card.
 */
export function WhatsNewCard({ onShow }: { onShow: () => void }) {
	const update = useUnseenUpdate();
	const transition = useMotionTransition({ duration: 0.1, ease: easing.in });

	return (
		<>
			{update && (
				<SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
					<SidebarMenuItem>
						<SidebarMenuButton onClick={onShow}>
							<SparklesIcon className="text-sidebar-primary" />
							<span>What’s new</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			)}
			<LazyMotion features={domAnimation} strict>
				<AnimatePresence initial={false}>
					{update && (
						<m.section
							key={update.id}
							aria-label="What's new"
							exit={{ opacity: 0, scale: 0.95 }}
							transition={transition}
							className="relative mb-1 flex flex-col gap-1 rounded-lg border bg-background p-3 text-sm shadow-xs/5 group-data-[collapsible=icon]:hidden"
						>
							<span className="text-xs font-medium text-sidebar-primary">What’s new</span>
							<h2 className="font-medium">{update.title}</h2>
							<p className="text-xs text-muted-foreground">{update.description}</p>
							<Button
								aria-label="Dismiss"
								className="absolute end-1.5 top-1.5 text-muted-foreground"
								onClick={dismissUpdate}
								size="icon-xs"
								variant="ghost"
							>
								<XIcon />
							</Button>
						</m.section>
					)}
				</AnimatePresence>
			</LazyMotion>
		</>
	);
}
