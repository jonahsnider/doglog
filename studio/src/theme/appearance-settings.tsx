import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldControl, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Fieldset, FieldsetLegend } from '@/components/ui/fieldset';
import { FramePanel } from '@/components/ui/frame';
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import { updateSettings, useSettings } from '@/settings';
import { type Contrast, contrasts, type Theme, type ThemePreset, themePresets, themes } from '@/theme/choices';
import { defaultCustomColor, type ThemePreviewColors, themePreviewColors } from '@/theme/theme-color';

const themeLabels: Record<Theme, string> = {
	light: 'Light',
	dark: 'Dark',
	system: 'System',
};

const themePresetLabels: Record<ThemePreset, string> = {
	team581: 'Team 581 maroon',
	match13: 'match13',
	coss: 'Neutral',
	custom: 'Custom',
};

const contrastLabels: Record<Contrast, string> = {
	standard: 'Standard',
	medium: 'Medium',
	high: 'High',
};

/** Settings panels for the theme and theme color */
export function AppearanceSettings() {
	const { theme, themeColor, themePreset, contrast } = useSettings();

	return (
		<>
			<FramePanel>
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
												<ThemePreview colors={themePreviewColors(themePreset, themeColor, false, contrast)} />
												<ThemePreview
													colors={themePreviewColors(themePreset, themeColor, true, contrast)}
													className="[clip-path:inset(0_0_0_50%)]"
												/>
											</>
										) : (
											<ThemePreview colors={themePreviewColors(themePreset, themeColor, value === 'dark', contrast)} />
										)}
									</div>
								</OptionCard>
							))}
						</div>
					</Fieldset>
				</Field>
			</FramePanel>

			<FramePanel className="flex flex-col gap-6">
				<Field name="themePreset">
					<Fieldset className="min-w-0 self-stretch">
						<FieldsetLegend className="mb-4 text-sm">Theme color</FieldsetLegend>
						<RadioGroup
							className="relative -m-1 -mb-3 grid auto-cols-[minmax(max-content,1fr)] grid-flow-col overflow-x-auto p-1 pb-3 scroll-p-1"
							value={themePreset}
							onValueChange={(value: ThemePreset) => updateSettings({ themePreset: value })}
						>
							{themePresets.map((value) => (
								<OptionCard key={value} value={value} label={themePresetLabels[value]}>
									<div className="flex justify-center gap-2 py-2">
										<ThemeSwatch colors={themePreviewColors(value, themeColor, false, contrast)} />
										<ThemeSwatch colors={themePreviewColors(value, themeColor, true, contrast)} />
									</div>
								</OptionCard>
							))}
						</RadioGroup>
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
			</FramePanel>
		</>
	);
}

/** Settings panel for the color scheme's contrast */
export function ContrastSetting() {
	const { themePreset, contrast } = useSettings();

	return (
		<FramePanel>
			<Field name="contrast" disabled={themePreset === 'coss'}>
				<Fieldset>
					<FieldsetLegend className="mb-1 text-sm">Contrast</FieldsetLegend>
					<SegmentedControl
						render={
							<RadioGroup
								className="flex-row gap-0.5"
								value={contrast}
								onValueChange={(value: Contrast) => updateSettings({ contrast: value })}
							/>
						}
					>
						{contrasts.map((value) => (
							<SegmentedControlItem key={value} render={<RadioPrimitive.Root value={value} />}>
								{contrastLabels[value]}
							</SegmentedControlItem>
						))}
					</SegmentedControl>
				</Fieldset>
				{themePreset === 'coss' && <FieldDescription>Neutral colors have a fixed contrast</FieldDescription>}
			</Field>
		</FramePanel>
	);
}

function OptionCard({ value, label, children }: { value: string; label: string; children: ReactNode }) {
	return (
		<RadioPrimitive.Root
			value={value}
			className="flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-2 text-sm text-muted-foreground outline-none transition-[border-color,box-shadow] hover:border-outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:border-primary data-checked:text-foreground data-checked:ring-1 data-checked:ring-primary"
		>
			{children}
			<span className="pb-0.5 text-center">{label}</span>
		</RadioPrimitive.Root>
	);
}

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

function ThemeSwatch({ colors }: { colors: ThemePreviewColors }) {
	return (
		<div
			aria-hidden
			className="aspect-square w-12 rounded-full border shadow-sm"
			style={{
				borderColor: colors.border,
				background: `linear-gradient(45deg, ${colors.surface}, ${colors.primary})`,
			}}
		/>
	);
}
