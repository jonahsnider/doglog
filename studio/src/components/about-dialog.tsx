import { Button } from '@astryxdesign/core/Button';
import { Code } from '@astryxdesign/core/Code';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { useSelector } from '@tanstack/react-store';
import CircleArrowUpIcon from 'lucide-react/icons/circle-arrow-up';
import RefreshCwIcon from 'lucide-react/icons/refresh-cw';
import { aboutDialogOpen } from '@/components/about-dialog-handle';
import { checkOrInstallUpdate, updateTitle, useUpdate } from '@/updater';
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
	const update = useUpdate();
	const installing = update?.installing ?? false;

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
							<HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
								<Text color="secondary">
									{STUDIO_VERSION === '0.0.0' ? (
										STUDIO_COMMIT === null ? (
											'Unversioned'
										) : (
											<Code color="inherit" size="inherit">
												{STUDIO_COMMIT}
											</Code>
										)
									) : (
										`v${STUDIO_VERSION}`
									)}
								</Text>
								<Button
									label={installing ? 'Updating…' : update ? updateTitle(update.update) : 'Check for updates'}
									icon={
										installing ? <Spinner size="sm" aria-hidden /> : update ? <CircleArrowUpIcon /> : <RefreshCwIcon />
									}
									variant="ghost"
									size="sm"
									isDisabled={installing}
									onClick={() => void checkOrInstallUpdate()}
								/>
							</HStack>
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
