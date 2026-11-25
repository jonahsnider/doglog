import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Layout';
import { List } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { type ReactNode, useId } from 'react';

/** A card of related rows, each a `ListItem` with its action at the end */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
	const titleId = useId();
	return (
		<VStack gap={1.5}>
			{title !== undefined && (
				<Text id={titleId} type="supporting" weight="semibold" color="secondary">
					{title}
				</Text>
			)}
			{/* The rows carry the inset, so the card has none */}
			<Card variant="muted" width="100%" padding={0}>
				<List hasDividers density="spacious" aria-labelledby={title === undefined ? undefined : titleId}>
					{children}
				</List>
			</Card>
		</VStack>
	);
}
