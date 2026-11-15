import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldControl, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Fieldset, FieldsetLegend } from '@/components/ui/fieldset';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { getRobotHost } from '@/robot-target';
import { type Theme, themes, updateSettings, useSettings } from '@/settings';
import {
	defaultCustomColor,
	type ThemePreset,
	type ThemePreviewColors,
	themePresets,
	themePreviewColors,
} from '@/theme-color';

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
	coss: 'Neutral',
	custom: 'Custom',
};

function Settings() {
	const { theme, themeColor, themePreset, robotTarget } = useSettings();
	const robotHost = getRobotHost(robotTarget);
	const robotTargetInvalid = robotTarget.trim() !== '' && robotHost === undefined;

	return (
		<div className="flex max-w-xl flex-col gap-8 p-6">
			<h1 className="font-heading text-2xl font-semibold">Settings</h1>

			<Field name="theme">
				<Fieldset
					render={
						<RadioGroup
							className="w-full"
							value={theme}
							onValueChange={(value: Theme) => updateSettings({ theme: value })}
						/>
					}
				>
					<FieldsetLegend className="mb-1 text-sm">Theme</FieldsetLegend>
					<div className="grid grid-cols-3 gap-3">
						{themes.map((value) => (
							<OptionCard key={value} value={value} label={themeLabels[value]}>
								<div className="relative aspect-16/10">
									{value === 'system' ? (
										<>
											<ThemePreview colors={themePreviewColors(themePreset, themeColor, false)} />
											<ThemePreview
												colors={themePreviewColors(themePreset, themeColor, true)}
												className="[clip-path:inset(0_0_0_50%)]"
											/>
										</>
									) : (
										<ThemePreview colors={themePreviewColors(themePreset, themeColor, value === 'dark')} />
									)}
								</div>
							</OptionCard>
						))}
					</div>
				</Fieldset>
			</Field>

			<Field name="themePreset">
				<Fieldset
					render={
						<RadioGroup
							className="w-full"
							value={themePreset}
							onValueChange={(value: ThemePreset) => updateSettings({ themePreset: value })}
						/>
					}
				>
					<FieldsetLegend className="mb-1 text-sm">Theme color</FieldsetLegend>
					<div className="grid grid-cols-3 gap-3">
						{themePresets.map((value) => (
							<OptionCard key={value} value={value} label={themePresetLabels[value]}>
								<div className="flex justify-center gap-2 py-2">
									<ThemeSwatch colors={themePreviewColors(value, themeColor, false)} />
									<ThemeSwatch colors={themePreviewColors(value, themeColor, true)} />
								</div>
							</OptionCard>
						))}
					</div>
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
							disabled={themeColor === defaultCustomColor}
							onClick={() => updateSettings({ themeColor: defaultCustomColor })}
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
						{robotHost === undefined ? 'Team number or IP address of the robot' : `Connect uses ${robotHost}`}
					</FieldDescription>
				)}
			</Field>
		</div>
	);
}

/** A large radio option showing a preview above its label */
function OptionCard({ value, label, children }: { value: string; label: string; children: ReactNode }) {
	return (
		<RadioPrimitive.Root
			value={value}
			className="flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-2 text-sm text-muted-foreground outline-none transition-[border-color,box-shadow] hover:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:border-primary data-checked:text-foreground data-checked:ring-1 data-checked:ring-primary"
		>
			{children}
			<span className="pb-0.5 text-center">{label}</span>
		</RadioPrimitive.Root>
	);
}

/** Miniature Studio window drawn in a theme's colors */
function ThemePreview({ colors, className }: { colors: ThemePreviewColors; className?: string }) {
	const bar = <div className="h-1.5 rounded-full" style={{ backgroundColor: colors.bar }} />;
	return (
		<div
			aria-hidden
			className={cn('absolute inset-0 flex overflow-hidden rounded-md border', className)}
			style={{ backgroundColor: colors.surface, borderColor: colors.border }}
		>
			<div
				className="flex w-1/4 flex-col gap-1 border-r p-1.5"
				style={{ backgroundColor: colors.sidebar, borderColor: colors.border }}
			>
				<div className="mb-1 h-2 rounded-full" style={{ backgroundColor: colors.accent }} />
				{bar}
				{bar}
			</div>
			<div className="flex flex-1 flex-col gap-1.5 p-2">
				<div className="w-3/4">{bar}</div>
				<div className="w-1/2">{bar}</div>
				<div className="mt-auto ml-auto h-2.5 w-1/3 rounded-full" style={{ backgroundColor: colors.primary }} />
			</div>
		</div>
	);
}

/** Round gradient between a theme's surface and primary colors */
function ThemeSwatch({ colors }: { colors: ThemePreviewColors }) {
	return (
		<div
			aria-hidden
			className="size-12 rounded-full border shadow-sm"
			style={{
				borderColor: colors.border,
				background: `linear-gradient(45deg, ${colors.surface}, ${colors.primary})`,
			}}
		/>
	);
}
