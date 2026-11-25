import { IconButton } from '@astryxdesign/core/IconButton';
import { colorVars, radiusVars, shadowVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import SparklesIcon from 'lucide-react/icons/sparkles';
import XIcon from 'lucide-react/icons/x';
import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react';
import { dismissUpdate, useUnseenUpdate } from '@/changelog/changelog';
import { easing, useMotionTransition } from '@/lib/motion';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/sidebar/sidebar-ui';

const styles = stylex.create({
	card: {
		position: 'relative',
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-1'],
		marginBottom: spacingVars['--spacing-1'],
		padding: spacingVars['--spacing-3'],
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		borderRadius: radiusVars['--radius-container'],
		backgroundColor: colorVars['--color-background-surface'],
		boxShadow: shadowVars['--shadow-low'],
		fontSize: typeScaleVars['--text-label-size'],
	},
	eyebrow: {
		color: colorVars['--color-text-accent'],
		fontSize: typeScaleVars['--text-supporting-size'],
		fontWeight: 500,
	},
	title: {
		margin: 0,
		fontSize: typeScaleVars['--text-label-size'],
		fontWeight: 500,
	},
	description: {
		margin: 0,
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
	},
	dismiss: {
		position: 'absolute',
		insetInlineEnd: spacingVars['--spacing-1-5'],
		top: spacingVars['--spacing-1-5'],
	},
});

/**
 * Announces the newest product update at the bottom of the sidebar until it's dismissed.
 * The collapsed sidebar shows an icon instead, which calls `onShow` to show the card, see `sidebar-ui.css`.
 */
export function WhatsNewCard({ onShow }: { onShow: () => void }) {
	const update = useUnseenUpdate();
	const transition = useMotionTransition({ duration: 0.1, ease: easing.in });

	return (
		<>
			{update && (
				<SidebarMenu data-whats-new-icon="">
					<SidebarMenuItem>
						<SidebarMenuButton onClick={onShow}>
							<SparklesIcon color="var(--color-icon-accent)" />
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
							data-whats-new-card=""
							data-sidebar-label=""
							{...stylex.props(styles.card)}
						>
							<span {...stylex.props(styles.eyebrow)}>What’s new</span>
							<h2 {...stylex.props(styles.title)}>{update.title}</h2>
							<p {...stylex.props(styles.description)}>{update.description}</p>
							<IconButton
								label="Dismiss"
								icon={<XIcon />}
								variant="ghost"
								size="sm"
								xstyle={styles.dismiss}
								onClick={dismissUpdate}
							/>
						</m.section>
					)}
				</AnimatePresence>
			</LazyMotion>
		</>
	);
}
