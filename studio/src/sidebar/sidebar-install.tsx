import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import SmartphoneIcon from 'lucide-react/icons/smartphone';
import { useState } from 'react';
import { isIOSDevice } from '@/lib/mobile-layout';
import { promptWebInstall, useInstalledWebApp, webInstallPrompt } from '@/lib/web-install';
import { SidebarMenuButton, SidebarMenuItem } from '@/sidebar/sidebar-ui';

const styles = stylex.create({
	steps: {
		display: 'grid',
		gap: spacingVars['--spacing-1'],
		margin: 0,
		paddingInlineStart: spacingVars['--spacing-5'],
		listStyleType: 'decimal',
	},
});

const label = 'Add to home screen';

export function SidebarInstall({ closing }: { closing: boolean }) {
	const installed = useInstalledWebApp();
	const prompt = useSelector(webInstallPrompt);
	const [instructionsOpen, setInstructionsOpen] = useState(false);
	const ios = isIOSDevice();
	if (installed || (!prompt && !instructionsOpen && !ios && 'onbeforeinstallprompt' in window)) {
		return null;
	}
	const showInstructions = instructionsOpen || prompt === undefined;

	return (
		<SidebarMenuItem data-expanded-row="" inert={closing}>
			<SidebarMenuButton
				size="sm"
				aria-haspopup={showInstructions ? 'dialog' : undefined}
				aria-expanded={showInstructions ? instructionsOpen : undefined}
				onClick={
					showInstructions
						? () => setInstructionsOpen(true)
						: () => void promptWebInstall().catch(() => setInstructionsOpen(true))
				}
			>
				<SmartphoneIcon />
				<span>{label}</span>
			</SidebarMenuButton>
			{showInstructions && (
				<Dialog isOpen={instructionsOpen} onOpenChange={setInstructionsOpen}>
					<Layout
						height="auto"
						header={<DialogHeader title={label} onOpenChange={setInstructionsOpen} />}
						content={
							<LayoutContent>
								{ios ? (
									<VStack gap={3}>
										<ol {...stylex.props(styles.steps)}>
											<li>
												Tap <strong>Share</strong> in your browser. In Safari, it may be under the page menu.
											</li>
											<li>
												Tap <strong>Add to Home Screen</strong>.
											</li>
											<li>
												Turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.
											</li>
										</ol>
										<Text as="p" type="supporting">
											If the option is missing, try opening Studio in Safari.
										</Text>
									</VStack>
								) : (
									<Text as="p">
										Open your browser’s menu, then tap <strong>Install</strong> or <strong>Add to Home screen</strong>.
									</Text>
								)}
							</LayoutContent>
						}
					/>
				</Dialog>
			)}
		</SidebarMenuItem>
	);
}
