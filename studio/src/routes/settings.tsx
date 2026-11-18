import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { CliField } from '@/components/cli-field';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/ui/frame';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { dragRegion, useTrafficLightsOverlap } from '@/desktop/title-bar';
import { cn } from '@/lib/utils';
import { getRobotHost } from '@/robot-target';
import { useAnonymousName } from '@/sharing/identity';
import { updateSettings, useSettings } from '@/settings';
import { AppearanceSettings } from '@/theme/appearance-settings';

export const Route = createFileRoute('/settings')({
	component: Settings,
});

function Settings() {
	const { name, robotTarget, mediaControls } = useSettings();
	const anonymousName = useAnonymousName();
	const robotHost = getRobotHost(robotTarget);
	const robotTargetInvalid = robotTarget.trim() !== '' && robotHost === undefined;
	const trafficLightsOverlap = useTrafficLightsOverlap();

	return (
		<div className="flex flex-1 flex-col overflow-y-auto">
			<div className="flex max-w-2xl grow flex-col gap-6 p-6">
				{/* Reaches the top of the window, where the title bar would be, and makes room for the title bar's buttons when they're over the page */}
				<h1
					{...dragRegion}
					className={cn('-mt-6 pt-6 font-heading text-2xl leading-none font-semibold', trafficLightsOverlap && 'ps-23')}
				>
					Settings
				</h1>

				<SettingsSection title="Appearance">
					<AppearanceSettings />
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

/** A titled group of related settings, each in its own panel */
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
