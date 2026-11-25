import { Button } from '@astryxdesign/core/Button';
import { Code } from '@astryxdesign/core/Code';
import { Field } from '@astryxdesign/core/Field';
import { HStack } from '@astryxdesign/core/Layout';
import { Selector } from '@astryxdesign/core/Selector';
import {
	colorVars,
	durationVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { focusOutlineProps } from '@astryxdesign/core/utils/focusOutline.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
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
	themeCards: {
		display: 'grid',
		gridTemplateColumns: 'repeat(3, 1fr)',
		gap: spacingVars['--spacing-3'],
	},
	presetCards: {
		display: 'grid',
		// Just fits both swatches, so every preset fits in a row of the settings page
		gridTemplateColumns: 'repeat(auto-fill, minmax(5.5rem, 1fr))',
		gap: spacingVars['--spacing-2'],
	},
	card: {
		display: 'flex',
		position: 'relative',
		flexDirection: 'column',
		gap: spacingVars['--spacing-2'],
		padding: spacingVars['--spacing-2'],
		cursor: 'pointer',
		color: {
			default: colorVars['--color-text-secondary'],
			':has(:checked)': colorVars['--color-text-primary'],
		},
		fontSize: typeScaleVars['--text-label-size'],
		textAlign: 'center',
		backgroundColor: colorVars['--color-background-card'],
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: {
			default: colorVars['--color-border'],
			':hover': colorVars['--color-border-emphasized'],
			':has(:checked)': colorVars['--color-accent'],
		},
		borderRadius: radiusVars['--radius-container'],
		boxShadow: {
			default: 'none',
			':has(:checked)': `inset 0 0 0 1px ${colorVars['--color-accent']}`,
		},
		transitionProperty: 'border-color, box-shadow, color',
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
	},
	swatches: {
		display: 'flex',
		justifyContent: 'center',
		gap: spacingVars['--spacing-1'],
		paddingBlock: spacingVars['--spacing-2'],
	},
	hiddenInput: {
		position: 'absolute',
		width: 1,
		height: 1,
		margin: -1,
		overflow: 'hidden',
		clipPath: 'inset(50%)',
		whiteSpace: 'nowrap',
	},
});

const themeLabels: Record<Theme, string> = {
	light: 'Light',
	dark: 'Dark',
	system: 'System',
};

const themePresetLabels: Record<ThemePreset, string> = {
	doglog: 'DogLog',
	match13: 'match13',
	froglog: 'FrogLog',
	hoglog: 'HogLog',
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
			<CardGroup label="Theme" name="theme" xstyle={styles.themeCards}>
				{themes.map((value) => (
					<OptionCard
						key={value}
						name="theme"
						label={themeLabels[value]}
						isChecked={theme === value}
						onCheck={() => updateSettings({ theme: value })}
					>
						<ThemeModePreview
							theme={value}
							light={themePreviewColors(themePreset, themeColor, false, highContrast)}
							dark={themePreviewColors(themePreset, themeColor, true, highContrast)}
						/>
					</OptionCard>
				))}
			</CardGroup>

			<CardGroup label="Theme color" name="theme-preset" xstyle={styles.presetCards}>
				{themePresets.map((value) => (
					<OptionCard
						key={value}
						name="theme-preset"
						label={themePresetLabels[value]}
						isChecked={themePreset === value}
						onCheck={() => updateSettings({ themePreset: value })}
					>
						<span {...stylex.props(styles.swatches)}>
							<ThemeSwatch colors={themePreviewColors(value, themeColor, false, highContrast)} />
							<ThemeSwatch colors={themePreviewColors(value, themeColor, true, highContrast)} />
						</span>
					</OptionCard>
				))}
			</CardGroup>

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

/**
 * Choices shown as cards with a preview, which Astryx has no single-choice component for. Each card is a native radio,
 * so the group gets arrow key navigation and one tab stop.
 */
function CardGroup({
	label,
	name,
	xstyle,
	children,
}: {
	label: string;
	name: string;
	xstyle: stylex.StyleXStyles;
	children: ReactNode;
}) {
	return (
		<Field label={label} inputID={name} labelID={`${name}-label`} isGroupLabel>
			<div role="radiogroup" aria-labelledby={`${name}-label`} {...stylex.props(xstyle)}>
				{children}
			</div>
		</Field>
	);
}

function OptionCard({
	name,
	label,
	isChecked,
	onCheck,
	children,
}: {
	name: string;
	label: string;
	isChecked: boolean;
	onCheck: () => void;
	children: ReactNode;
}) {
	return (
		<label {...focusOutlineProps.focusWithin(styles.card)}>
			<input type="radio" name={name} checked={isChecked} onChange={onCheck} {...stylex.props(styles.hiddenInput)} />
			{children}
			{label}
		</label>
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
