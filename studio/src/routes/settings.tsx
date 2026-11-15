import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Field, FieldControl, FieldDescription, FieldError, FieldItem, FieldLabel } from '@/components/ui/field';
import { Fieldset, FieldsetLegend } from '@/components/ui/fieldset';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { getRobotHost } from '@/robot-target';
import { type Theme, themes, updateSettings, useSettings } from '@/settings';
import { defaultThemeColor, type ThemePreset, themePresets } from '@/theme-color';

export const Route = createFileRoute('/settings')({
	component: Settings,
});

const themeLabels: Record<Theme, string> = {
	light: 'Light',
	dark: 'Dark',
	system: 'System',
};

const themePresetLabels: Record<ThemePreset, string> = {
	team581: 'Team 581 maroon',
	coss: 'coss ui',
	custom: 'Custom',
};

function Settings() {
	const { theme, themeColor, themePreset, robotTarget } = useSettings();
	const robotHost = getRobotHost(robotTarget);
	const robotTargetInvalid = robotTarget.trim() !== '' && robotHost === undefined;

	return (
		<div className="flex max-w-md flex-col gap-8 p-6">
			<h1 className="font-heading text-2xl font-semibold">Settings</h1>

			<Field name="theme">
				<Fieldset
					render={<RadioGroup value={theme} onValueChange={(value: Theme) => updateSettings({ theme: value })} />}
				>
					<FieldsetLegend className="mb-1 text-sm">Theme</FieldsetLegend>
					{themes.map((value) => (
						<Label key={value} className="font-normal">
							<Radio value={value} />
							{themeLabels[value]}
						</Label>
					))}
				</Fieldset>
			</Field>

			<Field name="themePreset">
				<Fieldset
					render={
						<RadioGroup
							value={themePreset}
							onValueChange={(value: ThemePreset) => updateSettings({ themePreset: value })}
						/>
					}
				>
					<FieldsetLegend className="mb-1 text-sm">Theme color</FieldsetLegend>
					{themePresets.map((value) => (
						<FieldItem key={value}>
							<FieldLabel className="font-normal">
								<Radio value={value} />
								{themePresetLabels[value]}
							</FieldLabel>
						</FieldItem>
					))}
				</Fieldset>
			</Field>

			{themePreset === 'custom' && (
				<Field name="themeColor">
					<FieldLabel>Custom color</FieldLabel>
					<div className="flex items-center gap-3">
						<FieldControl
							type="color"
							value={themeColor}
							onValueChange={(value) => updateSettings({ themeColor: value })}
							className="h-8 w-12 cursor-pointer rounded-lg border border-input bg-background p-0.5 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
						/>
						<span className="font-mono text-sm text-muted-foreground">{themeColor}</span>
						<Button
							variant="outline"
							size="sm"
							disabled={themeColor === defaultThemeColor}
							onClick={() => updateSettings({ themeColor: defaultThemeColor, themePreset: 'team581' })}
						>
							Reset to default
						</Button>
					</div>
				</Field>
			)}

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
						{robotHost === undefined ? 'Team number or IP address of the robot' : `Connect to robot uses ${robotHost}`}
					</FieldDescription>
				)}
			</Field>
		</div>
	);
}
