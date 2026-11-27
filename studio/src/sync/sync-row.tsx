import { Card } from '@astryxdesign/core/Card';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Text } from '@astryxdesign/core/Text';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { LucideIcon } from 'lucide-react/types';
import type { ReactNode } from 'react';

const spin = stylex.keyframes({ to: { transform: 'rotate(360deg)' } });

const styles = stylex.create({
	icon: { flexShrink: 0 },
	// Lines up with the title, past the icon and the gap after it
	below: { paddingInlineStart: `calc(20px + ${spacingVars['--spacing-3']})` },
	// Slows down instead of stopping when reducing motion, so it still shows that sync is working
	spinning: {
		animationName: spin,
		animationDuration: 'calc(8s - 5s * var(--motion-scale))',
		animationTimingFunction: 'linear',
		animationIterationCount: 'infinite',
	},
});

/**
 * One of the Logs page's sync rows, see the log-sync spec's Logs page header: what it's doing, its progress, and its
 * buttons, with anything else it shows below. Text stays on one line, with the rest in a tooltip.
 */
export function SyncRow({
	icon: Icon,
	isSpinning = false,
	title,
	detail,
	progress,
	actions,
	children,
}: {
	icon: LucideIcon;
	isSpinning?: boolean;
	title: string;
	detail?: ReactNode;
	progress?: { value: number; max: number };
	actions?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<Card variant="muted" padding={3} width="100%">
			<VStack gap={3}>
				<HStack gap={3} vAlign="center">
					<Icon size={20} aria-hidden {...stylex.props(styles.icon, isSpinning && styles.spinning)} />
					<StackItem size="fill">
						<VStack gap={0.5}>
							<Text type="label" maxLines={1}>
								{title}
							</Text>
							{detail !== undefined && (
								<Text type="supporting" color="secondary" maxLines={1} hasTabularNumbers>
									{detail}
								</Text>
							)}
						</VStack>
					</StackItem>
					{actions !== undefined && (
						<HStack gap={1} vAlign="center">
							{actions}
						</HStack>
					)}
				</HStack>
				{(progress !== undefined || children !== undefined) && (
					<VStack gap={3} xstyle={styles.below}>
						{progress && (
							<ProgressBar label={title} isLabelHidden value={progress.value} max={Math.max(progress.max, 1)} />
						)}
						{children}
					</VStack>
				)}
			</VStack>
		</Card>
	);
}
