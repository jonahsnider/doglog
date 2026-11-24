import { HStack, Layout, LayoutContent, LayoutHeader, StackItem, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { dragRegion } from '@/desktop/title-bar';

const styles = stylex.create({
	section: {
		display: 'grid',
		columnGap: spacingVars['--spacing-10'],
		rowGap: spacingVars['--spacing-4'],
		gridTemplateColumns: {
			default: 'minmax(0, 1fr)',
			'@media (min-width: 64rem)': '14rem minmax(0, 1fr)',
		},
	},
});

export function UtilityPage({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
	return (
		<Layout
			contentWidth={896}
			header={
				<LayoutHeader {...dragRegion} hasDivider>
					<HStack vAlign="center" wrap="wrap" gap={2}>
						<StackItem size="fill">
							<Heading level={1}>{title}</Heading>
						</StackItem>
						{actions}
					</HStack>
				</LayoutHeader>
			}
			content={<LayoutContent padding={4}>{children}</LayoutContent>}
		/>
	);
}

/**
 * One group of a utility page, with its title and description beside its content on wide screens and above it on
 * narrow ones. Separate groups with a `Divider`.
 */
export function UtilityPageSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section {...stylex.props(styles.section)}>
			<VStack gap={1}>
				<Heading level={2}>{title}</Heading>
				{description !== undefined && (
					<Text type="supporting" color="secondary">
						{description}
					</Text>
				)}
			</VStack>
			<VStack gap={6}>{children}</VStack>
		</section>
	);
}
