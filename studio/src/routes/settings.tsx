import { createFileRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import type { ReactNode } from 'react';
import { cloudAccountStore } from '@/cloud/session';
import { aboutDialog } from '@/components/about-dialog-handle';
import { CliField } from '@/components/cli-field';
import { Button } from '@/components/ui/button';
import { DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { FramePanel } from '@/components/ui/frame';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
			actions={
				<DialogTrigger handle={aboutDialog} render={<Button variant="outline" />}>
					About DogLog Studio
				</DialogTrigger>
			}
		>
			<div className="flex max-w-2xl flex-1 flex-col gap-6">
				<UtilityPageSection title="Appearance">
					<AppearanceSettings />
				</UtilityPageSection>

				<UtilityPageSection title="Accessibility">
					<ContrastSetting />
					<VisualizationPaletteSetting />

					<FramePanel>
						<Field name="reduceMotion">
							<FieldLabel>
								<Switch
									checked={reduceMotion}
									onCheckedChange={(checked) => updateSettings({ reduceMotion: checked })}
								/>
								Reduce motion
							</FieldLabel>
							<FieldDescription>Skip layout animations, always on when your system reduces motion</FieldDescription>
						</Field>
					</FramePanel>
				</UtilityPageSection>

				<UtilityPageSection title="Robot">
					<FramePanel>
						<Field name="robotTarget" invalid={robotTargetInvalid}>
							<FieldLabel>Robot connection</FieldLabel>
							<Input
								value={robotTarget}
								onValueChange={(value) => updateSettings({ robotTarget: value })}
								placeholder="581 or 10.5.81.2"
								autoComplete="off"
								spellCheck={false}
							/>
							{robotTargetInvalid ? (
								<FieldError match>Enter a team number or an IP address</FieldError>
							) : (
								<FieldDescription>
									{robotHost === undefined ? 'Team number or IP address of the robot' : `Connect uses ${robotHost}`}
								</FieldDescription>
							)}
						</Field>
					</FramePanel>
					<FramePanel>
						<Field name="reduceLiveBandwidth">
							<FieldLabel>
								<Switch
									checked={reduceLiveBandwidth}
									onCheckedChange={(checked) => updateSettings({ reduceLiveBandwidth: checked })}
								/>
								Reduce live bandwidth
							</FieldLabel>
							<FieldDescription>
								Keep dashboard entries responsive and sample other entries about every 2 seconds. Live recordings may
								miss changes.
							</FieldDescription>
						</Field>
					</FramePanel>
				</UtilityPageSection>

				{!hasCloudAccount && (
					<UtilityPageSection title="Sharing">
						<FramePanel>
							<Field name="name">
								<FieldLabel>Name</FieldLabel>
								<Input
									value={name}
									onValueChange={(value) => updateSettings({ name: value })}
									placeholder={anonymousName}
									autoComplete="name"
								/>
								<FieldDescription>Shown to others in shared dashboards</FieldDescription>
							</Field>
						</FramePanel>
					</UtilityPageSection>
				)}

				<UtilityPageSection title="System">
					<FramePanel>
						<Field name="mediaControls">
							<FieldLabel>
								<Switch
									checked={mediaControls}
									onCheckedChange={(checked) => updateSettings({ mediaControls: checked })}
								/>
								Media controls
							</FieldLabel>
							<FieldDescription>
								Play, pause, and seek logs with media keys and the system media controls
							</FieldDescription>
						</Field>
					</FramePanel>

					{!reportsNaturalScrolling && (
						<FramePanel>
							<Field name="naturalScrolling">
								<FieldLabel>
									<Switch
										checked={naturalScrolling}
										onCheckedChange={(checked) => updateSettings({ naturalScrolling: checked })}
									/>
									Natural scrolling
								</FieldLabel>
								<FieldDescription>Match your trackpad so scrolling the timeline follows your fingers</FieldDescription>
							</Field>
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
