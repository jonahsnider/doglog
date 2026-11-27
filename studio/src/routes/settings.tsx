import { Button } from '@astryxdesign/core/Button';
import { Code } from '@astryxdesign/core/Code';
import { Divider } from '@astryxdesign/core/Divider';
import { VStack } from '@astryxdesign/core/Layout';
import { Link } from '@astryxdesign/core/Link';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { createFileRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { cloudAccountStore } from '@/cloud/session';
import { aboutDialogOpen } from '@/components/about-dialog-handle';
import { CliField } from '@/components/cli-field';
import { UtilityPage, UtilityPageSection } from '@/components/utility-page';
import { getRobotHost } from '@/robot-target';
import { useAnonymousName } from '@/sharing/identity';
import { hasFrostedFrame, reportsNaturalScrolling, updateSettings, useSettings } from '@/settings';
import { AppearanceSettings, VisualizationPaletteSetting } from '@/theme/appearance-settings';
import { RobotProjectsSetting } from '@/widgets/robot/robot-projects-setting';

export const Route = createFileRoute('/settings')({
	component: Settings,
});

function Settings() {
	const {
		name,
		robotTarget,
		reduceLiveBandwidth,
		mediaControls,
		naturalScrolling,
		reduceMotion,
		reduceTransparency,
		highContrast,
	} = useSettings();
	const hasCloudAccount = useSelector(cloudAccountStore, (account) => account !== null);
	const anonymousName = useAnonymousName();
	const robotHost = getRobotHost(robotTarget);
	const robotTargetInvalid = robotTarget.trim() !== '' && robotHost === undefined;

	return (
		<UtilityPage
			title="Settings"
			actions={<Button label="About DogLog Studio" onClick={() => aboutDialogOpen.set(true)} />}
		>
			<VStack gap={8}>
				<UtilityPageSection title="Appearance" description="How Studio looks">
					<AppearanceSettings />
				</UtilityPageSection>

				<Divider />

				<UtilityPageSection title="Accessibility" description="Make Studio easier to see and use">
					<Switch
						label="High contrast"
						description="Stronger text and borders, always on when your system increases contrast"
						value={highContrast}
						onChange={(checked) => updateSettings({ highContrast: checked })}
					/>
					<VisualizationPaletteSetting />
					<Switch
						label="Reduce motion"
						description="Skip layout animations, always on when your system reduces motion"
						value={reduceMotion}
						onChange={(checked) => updateSettings({ reduceMotion: checked })}
					/>
					{hasFrostedFrame && (
						<Switch
							label="Reduce transparency"
							description="Solid window background, always on when your system reduces transparency"
							value={reduceTransparency}
							onChange={(checked) => updateSettings({ reduceTransparency: checked })}
						/>
					)}
				</UtilityPageSection>

				<Divider />

				<UtilityPageSection title="Robot" description="How Studio connects to your robot">
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
						status={robotTargetInvalid ? { type: 'error', message: 'Enter a team number or an IP address' } : undefined}
					/>
					<Switch
						label="Reduce live bandwidth"
						description="Keep dashboard entries responsive and sample other entries about every 2 seconds. Live recordings may miss changes."
						value={reduceLiveBandwidth}
						onChange={(checked) => updateSettings({ reduceLiveBandwidth: checked })}
					/>
				</UtilityPageSection>

				<Divider />

				<UtilityPageSection
					title="Robot projects"
					description={<>Show your robot&apos;s 3D models in visualizations by adding its project folder</>}
				>
					<RobotProjectsSetting />
				</UtilityPageSection>

				{!hasCloudAccount && (
					<>
						<Divider />
						<UtilityPageSection title="Sharing">
							<TextInput
								label="Name"
								description="Shown to others in shared dashboards"
								value={name}
								onChange={(value) => updateSettings({ name: value })}
								placeholder={anonymousName}
								autoComplete="name"
							/>
						</UtilityPageSection>
					</>
				)}

				<Divider />

				<UtilityPageSection title="System" description="How Studio works with your computer">
					<Switch
						label="Media controls"
						description="Play, pause, and seek logs with media keys and the system media controls"
						value={mediaControls}
						onChange={(checked) => updateSettings({ mediaControls: checked })}
					/>
					{!reportsNaturalScrolling && (
						<Switch
							label="Natural scrolling"
							description="Match your trackpad so scrolling the timeline follows your fingers"
							value={naturalScrolling}
							onChange={(checked) => updateSettings({ naturalScrolling: checked })}
						/>
					)}
					<CliField />
				</UtilityPageSection>

				<Divider />

				<VStack gap={1}>
					<Text type="supporting" color="secondary">
						DogLog Studio {STUDIO_VERSION}
						{STUDIO_COMMIT !== null && (
							<>
								{' '}
								(
								<Code color="inherit" size="inherit">
									{STUDIO_COMMIT}
								</Code>
								)
							</>
						)}
					</Text>
					<Text type="supporting" color="secondary">
						<Link href="https://github.com/jonahsnider/doglog" isExternalLink type="inherit" color="inherit">
							GitHub
						</Link>
					</Text>
					<Text type="supporting" color="secondary">
						By{' '}
						<Link href="https://jonahsnider.com" isExternalLink type="inherit" color="inherit">
							Jonah Snider
						</Link>
					</Text>
				</VStack>
			</VStack>
		</UtilityPage>
	);
}
