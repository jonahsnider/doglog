import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { CliField } from '@/components/cli-field';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/ui/frame';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { dragRegion } from '@/desktop/title-bar';
import { getRobotHost } from '@/robot-target';
import { useAnonymousName } from '@/sharing/identity';
import { reportsNaturalScrolling, updateSettings, useSettings } from '@/settings';
import { AppearanceSettings, ContrastSetting } from '@/theme/appearance-settings';

export const Route = createFileRoute('/settings')({
	component: Settings,
});

function Settings() {
	const { name, robotTarget, mediaControls, naturalScrolling, reduceMotion } = useSettings();
	const anonymousName = useAnonymousName();
	const robotHost = getRobotHost(robotTarget);
	const robotTargetInvalid = robotTarget.trim() !== '' && robotHost === undefined;

	return (
		<div className="flex flex-1 flex-col overflow-y-auto">
			<div className="flex max-w-2xl grow flex-col gap-6 p-6">
				{/* Reaches the top of the page and sticks there, its bottom padding replaces some of the gap so there's room between it and the content scrolling under it */}
				<h1
					{...dragRegion}
					className="sticky top-0 z-10 -mt-6 -mb-3 bg-background pt-6 pb-3 font-heading text-2xl font-semibold"
				>
					Settings
				</h1>

				<SettingsSection title="Appearance">
					<AppearanceSettings />
				</SettingsSection>

				<SettingsSection title="Accessibility">
					<ContrastSetting />

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
				</SettingsSection>

				<SettingsSection title="Robot">
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
				</SettingsSection>

				<SettingsSection title="Sharing">
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
				</SettingsSection>

				<SettingsSection title="System">
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
				</SettingsSection>

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
		</div>
	);
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Frame>
			<FrameHeader>
				<FrameTitle>
					<h2 className="font-heading text-base leading-none">{title}</h2>
				</FrameTitle>
			</FrameHeader>
			{children}
		</Frame>
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
