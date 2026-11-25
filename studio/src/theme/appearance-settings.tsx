import { Button } from '@astryxdesign/core/Button';
import { Code } from '@astryxdesign/core/Code';
import { Field } from '@astryxdesign/core/Field';
import { HStack } from '@astryxdesign/core/Layout';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { Selector } from '@astryxdesign/core/Selector';
import { colorVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { updateSettings, useSettings } from '@/settings';
import {
	type Theme,
	type ThemePreset,
	themePresets,
	themes,
	type VisualizationPalette,
	visualizationPalettes,
} from '@/theme/choices';
import { seriesPaletteColors } from '@/theme/series-palette';
import { defaultCustomColor, themePreviewColors } from '@/theme/theme-color';
import { ThemeModePreview, ThemeSwatch } from '@/theme/theme-preview';

const styles = stylex.create({
	paletteSwatch: {
		display: 'block',
		width: spacingVars['--spacing-3'],
		aspectRatio: '1',
		borderRadius: radiusVars['--radius-full'],
		forcedColorAdjust: 'none',
	},
	colorInput: {
		width: spacingVars['--spacing-12'],
		height: spacingVars['--spacing-8'],
		padding: spacingVars['--spacing-0-5'],
		cursor: 'pointer',
		backgroundColor: colorVars['--color-background-body'],
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-border-emphasized'],
		borderRadius: radiusVars['--radius-element'],
	},
	fill: (color: string) => ({ backgroundColor: color }),
});

const themeLabels: Record<Theme, string> = {
	light: 'Light',
	dark: 'Dark',
	system: 'System',
};

const themePresetLabels: Record<ThemePreset, string> = {
	team581: 'Team 581 maroon',
	match13: 'match13',
	froglog: 'FrogLog',
	neutral: 'Neutral',
	custom: 'Custom',
};

const visualizationPaletteLabels: Record<VisualizationPalette, string> = {
	default: 'Default',
	protan: 'Red–green (protan)',
	deutan: 'Red–green (deutan)',
	tritan: 'Blue–yellow (tritan)',
};
const visualizationPaletteItems = visualizationPalettes.map((value) => ({
	value,
	label: visualizationPaletteLabels[value],
}));

export function AppearanceSettings() {
	const { theme, themeColor, themePreset, highContrast } = useSettings();

	return (
		<>
			<RadioList
				label="Theme"
				orientation="horizontal"
				value={theme}
				onChange={(value) => updateSettings({ theme: themes.find((choice) => choice === value) ?? theme })}
			>
				{themes.map((value) => (
					<RadioListItem
						key={value}
						value={value}
						label={themeLabels[value]}
						align="first-line"
						description={
							<ThemeModePreview
								theme={value}
								light={themePreviewColors(themePreset, themeColor, false, highContrast)}
								dark={themePreviewColors(themePreset, themeColor, true, highContrast)}
							/>
						}
					/>
				))}
			</RadioList>

			<RadioList
				label="Theme color"
				value={themePreset}
				onChange={(value) =>
					updateSettings({ themePreset: themePresets.find((choice) => choice === value) ?? themePreset })
				}
			>
				{themePresets.map((value) => (
					<RadioListItem
						key={value}
						value={value}
						label={themePresetLabels[value]}
						endContent={
							<HStack gap={1}>
								<ThemeSwatch colors={themePreviewColors(value, themeColor, false, highContrast)} />
								<ThemeSwatch colors={themePreviewColors(value, themeColor, true, highContrast)} />
							</HStack>
						}
					/>
				))}
			</RadioList>

			{themePreset === 'custom' && (
				<Field label="Custom color" inputID="theme-color">
					<HStack gap={3} vAlign="center">
						<input
							id="theme-color"
							type="color"
							value={themeColor}
							onChange={(event) => updateSettings({ themeColor: event.currentTarget.value })}
							{...stylex.props(styles.colorInput)}
						/>
						<Code color="secondary">{themeColor}</Code>
						<Button
							label="Reset to default"
							size="sm"
							isDisabled={themeColor === defaultCustomColor}
							onClick={() => updateSettings({ themeColor: defaultCustomColor })}
						/>
					</HStack>
				</Field>
			)}
		</>
	);
}

export function VisualizationPaletteSetting() {
	const { visualizationPalette } = useSettings();

	return (
		<Selector
			label="Visualization colors"
			options={visualizationPaletteItems}
			value={visualizationPalette}
			onChange={(value) =>
				updateSettings({
					visualizationPalette: visualizationPalettes.find((choice) => choice === value) ?? visualizationPalette,
				})
			}
			renderOption={(option) => <PaletteOption value={option.value} />}
			renderValue={(option) => <PaletteOption value={option.value} />}
			width={288}
		/>
	);
}

/** Selector options are strings, so this finds the palette an option's value names */
function PaletteOption({ value }: { value: string }) {
	const palette = visualizationPalettes.find((choice) => choice === value) ?? 'default';
	return (
		<HStack hAlign="between" vAlign="center" wrap="wrap" gap={2} width="100%">
			{visualizationPaletteLabels[palette]}
			<PaletteSwatches palette={palette} />
		</HStack>
	);
}

function PaletteSwatches({ palette }: { palette: VisualizationPalette }) {
	const colors = seriesPaletteColors[palette].light.map(
		(color, index) => `light-dark(${color}, ${seriesPaletteColors[palette].dark[index]})`,
	);

	return (
		<HStack gap={1} aria-hidden="true">
			{colors.map((color) => (
				<span key={color} {...stylex.props(styles.paletteSwatch, styles.fill(color))} />
			))}
		</HStack>
	);
}
