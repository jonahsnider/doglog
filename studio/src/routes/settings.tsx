import { createFileRoute } from '@tanstack/react-router';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Fieldset, FieldsetLegend } from '@/components/ui/fieldset';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { getRobotHost } from '@/robot-target';
import { type Theme, themes, updateSettings, useSettings } from '@/settings';

export const Route = createFileRoute('/settings')({
	component: Settings,
});

const themeLabels: Record<Theme, string> = {
	light: 'Light',
	dark: 'Dark',
	system: 'System',
};

function Settings() {
	const { theme, robotTarget } = useSettings();
	const robotHost = getRobotHost(robotTarget);
	const robotTargetInvalid = robotTarget.trim() !== '' && robotHost === undefined;

	return (
		<div className="flex max-w-md flex-col gap-8 p-6">
			<h1 className="font-heading text-2xl font-semibold">Settings</h1>

			<Field name="theme">
				<Fieldset
					render={<RadioGroup value={theme} onValueChange={(value) => updateSettings({ theme: value as Theme })} />}
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
						{robotHost ? `Connect to robot uses ${robotHost}` : 'Team number or IP address of the robot'}
					</FieldDescription>
				)}
			</Field>
		</div>
	);
}
