import { Code } from '@astryxdesign/core/Code';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { useSelector } from '@tanstack/react-store';
import { aboutDialogOpen } from '@/components/about-dialog-handle';
import { bundle } from '../../src-tauri/tauri.conf.json';

const thanks = [
	{ name: 'Saikiran Ramanan, Simon P, and the 581 software team', reason: 'Early testing and feedback' },
	{ name: 'Chris Lawson', reason: 'ntcore-ts' },
	{ name: 'Connor Horn', reason: 'Angel investor' },
	{ name: 'Eugene Fang', reason: 'He knows what he did' },
];

const setOpen = (next: boolean) => aboutDialogOpen.set(next);

export function AboutDialog() {
	const open = useSelector(aboutDialogOpen);

	return (
		<Dialog isOpen={open} onOpenChange={setOpen} width={448}>
			<Layout
				header={
					<DialogHeader
						title="DogLog Studio"
						subtitle={bundle.shortDescription}
						startContent={<img src="/logo.svg" alt="" width={40} height={40} />}
						onOpenChange={setOpen}
					/>
				}
				content={
					<LayoutContent>
						<VStack gap={4}>
							<Text type="supporting" color="secondary">
								Version {STUDIO_VERSION}
								{STUDIO_COMMIT !== null && (
									<>
										{' '}
										(<Code color="inherit">{STUDIO_COMMIT}</Code>)
									</>
								)}
							</Text>
							<List header="Thanks to" density="compact" edge="flush">
								{thanks.map(({ name, reason }) => (
									<ListItem key={name} label={name} description={reason} />
								))}
							</List>
						</VStack>
					</LayoutContent>
				}
				footer={
					<LayoutFooter>
						<Text type="supporting" color="secondary">
							{bundle.copyright}
						</Text>
					</LayoutFooter>
				}
			/>
		</Dialog>
	);
}
