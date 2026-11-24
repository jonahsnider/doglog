import { Button } from '@astryxdesign/core/Button';
import { Switch } from '@astryxdesign/core/Switch';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createFileRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import type { ReactNode } from 'react';
import { cloudAccountStore } from '@/cloud/session';
import { aboutDialog } from '@/components/about-dialog-handle';
import { CliField } from '@/components/cli-field';
import { FramePanel } from '@/components/ui/frame';
import { UtilityPage, UtilityPageSection } from '@/components/utility-page';
import { getRobotHost } from '@/robot-target';
import { useAnonymousName } from '@/sharing/identity';
import { reportsNaturalScrolling, updateSettings, useSettings } from '@/settings';
import { AppearanceSettings, ContrastSetting, VisualizationPaletteSetting } from '@/theme/appearance-settings';

export const Route = createFileRoute('/settings')({
	component: Settings,
});

function Settings() {
	const { name, robotTarget, reduceLiveBandwidth, mediaControls, naturalScrolling, reduceMotion } = useSettings();
	const hasCloudAccount = useSelector(cloudAccountStore, (account) => account !== null);
	const anonymousName = useAnonymousName();
	const robotHost = getRobotHost(robotTarget);
	const robotTargetInvalid = robotTarget.trim() !== '' && robotHost === undefined;

	return (
		<UtilityPage
			title="Settings"
			actions={<Button label="About DogLog Studio" onClick={() => aboutDialog.open(null)} />}
		>
			<div className="flex max-w-2xl flex-1 flex-col gap-6">
				<UtilityPageSection title="Appearance">
					<AppearanceSettings />
				</UtilityPageSection>

				<UtilityPageSection title="Accessibility">
					<ContrastSetting />
					<VisualizationPaletteSetting />

					<FramePanel>
						<Switch
							label="Reduce motion"
							description="Skip layout animations, always on when your system reduces motion"
							value={reduceMotion}
							onChange={(checked) => updateSettings({ reduceMotion: checked })}
						/>
					</FramePanel>
				</UtilityPageSection>

				<UtilityPageSection title="Robot">
					<FramePanel>
						<TextInput
							label="Robot connection"
							description={
								robotHost === undefined ? 'Team number or IP address of the robot' : `Connect uses ${robotHost}`
							}
							value={robotTarget}
							onChange={(value) => updateSettings({ robotTarget: value })}
							placeholder="581 or 10.5.81.2"
							autoComplete="off"
							hasSpellCheck={false}
							status={
								robotTargetInvalid ? { type: 'error', message: 'Enter a team number or an IP address' } : undefined
							}
						/>
					</FramePanel>
					<FramePanel>
						<Switch
							label="Reduce live bandwidth"
							description="Keep dashboard entries responsive and sample other entries about every 2 seconds. Live recordings may miss changes."
							value={reduceLiveBandwidth}
							onChange={(checked) => updateSettings({ reduceLiveBandwidth: checked })}
						/>
					</FramePanel>
				</UtilityPageSection>

				{!hasCloudAccount && (
					<UtilityPageSection title="Sharing">
						<FramePanel>
							<TextInput
								label="Name"
								description="Shown to others in shared dashboards"
								value={name}
								onChange={(value) => updateSettings({ name: value })}
								placeholder={anonymousName}
								autoComplete="name"
							/>
						</FramePanel>
					</UtilityPageSection>
				)}

				<UtilityPageSection title="System">
					<FramePanel>
						<Switch
							label="Media controls"
							description="Play, pause, and seek logs with media keys and the system media controls"
							value={mediaControls}
							onChange={(checked) => updateSettings({ mediaControls: checked })}
						/>
					</FramePanel>

					{!reportsNaturalScrolling && (
						<FramePanel>
							<Switch
								label="Natural scrolling"
								description="Match your trackpad so scrolling the timeline follows your fingers"
								value={naturalScrolling}
								onChange={(checked) => updateSettings({ naturalScrolling: checked })}
							/>
						</FramePanel>
					)}

					<CliField />
				</UtilityPageSection>

				<div className="mt-auto flex flex-col gap-1 pt-10 text-sm text-muted-foreground">
					<p>
						DogLog Studio {STUDIO_VERSION}
						{STUDIO_COMMIT !== null && (
							<>
								{' '}
								(<span className="font-mono">{STUDIO_COMMIT}</span>)
							</>
						)}
					</p>
					<p>
						<ExternalLink href="https://github.com/jonahsnider/doglog">GitHub</ExternalLink>
					</p>
					<p>
						By <ExternalLink href="https://jonahsnider.com">Jonah Snider</ExternalLink>
					</p>
				</div>
			</div>
		</UtilityPage>
	);
}

/** Opens in a new tab on the web, and in the default browser on desktop */
function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="underline-offset-4 hover:text-foreground hover:underline"
		>
			{children}
		</a>
	);
}
