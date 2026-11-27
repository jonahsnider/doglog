// oxlint-disable max-lines -- Appearance settings and the option cards they share are kept together
import { Button } from '@astryxdesign/core/Button';
import { Code } from '@astryxdesign/core/Code';
import { Field } from '@astryxdesign/core/Field';
import { HStack } from '@astryxdesign/core/Layout';
import { Link } from '@astryxdesign/core/Link';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import {
	colorVars,
	durationVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { focusOutlineProps } from '@astryxdesign/core/utils/focusOutline.stylex';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import type { ReactNode } from 'react';
import { updateSettings, useSettings } from '@/settings';
import {
	defaultThemePreset,
	type Theme,
	type ThemePreset,
	themePresets,
	themes,
	type VisualizationPalette,
	visualizationPalettes,
} from '@/theme/choices';
import { seriesPaletteColors } from '@/theme/series-palette';
import { colorsTeamNumberStore } from '@/theme/team-colors';
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
		// Four to a row at the settings page's full width, so the presets take two rows
		gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))',
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

/** The team preset is named for the team whose colors it uses */
const themePresetLabels: Record<ThemePreset, (teamNumber: number | null) => string> = {
	doglog: () => 'DogLog',
	match13: () => 'match13',
	froglog: () => 'FrogLog',
	hoglog: () => 'HogLog',
	neutral: () => 'Neutral',
	'frc-colors': (teamNumber) => (teamNumber === null ? 'Your team' : `Team ${teamNumber}`),
	custom: () => 'Custom',
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
	const { theme, themeColor, frcColors, highContrast, ...settings } = useSettings();
	const themePreset = settings.themePreset ?? defaultThemePreset;
	const inputs = { themeColor, teamColors: frcColors?.colors ?? null };
	const teamNumber = useSelector(colorsTeamNumberStore);

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
							light={themePreviewColors(themePreset, inputs, false, highContrast)}
							dark={themePreviewColors(themePreset, inputs, true, highContrast)}
						/>
					</OptionCard>
				))}
			</CardGroup>

			<CardGroup label="Theme color" name="theme-preset" xstyle={styles.presetCards}>
				{themePresets.map((value) => (
					<OptionCard
						key={value}
						name="theme-preset"
						label={themePresetLabels[value](teamNumber)}
						isChecked={themePreset === value}
						onCheck={() => updateSettings({ themePreset: value })}
					>
						<span {...stylex.props(styles.swatches)}>
							<ThemeSwatch colors={themePreviewColors(value, inputs, false, highContrast)} />
							<ThemeSwatch colors={themePreviewColors(value, inputs, true, highContrast)} />
						</span>
					</OptionCard>
				))}
			</CardGroup>

			{themePreset === 'frc-colors' && <FrcColorsStatus />}

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

/** Which team's colors the team preset uses, or why it uses DogLog's */
function FrcColorsStatus() {
	const { frcColors } = useSettings();
	const teamNumber = useSelector(colorsTeamNumberStore);
	const source = (
		<Link href="https://frc-colors.com" isExternalLink type="inherit" color="inherit">
			FRC Colors
		</Link>
	);
	let status: ReactNode;
	if (teamNumber === null) {
		status = 'Enter your team number in Robot connection to use your team’s colors.';
	} else if (frcColors?.teamNumber !== teamNumber) {
		status = `Getting team ${teamNumber}’s colors…`;
	} else if (frcColors.colors === null) {
		status = (
			<>
				Team {teamNumber} doesn’t have colors on {source} yet, so DogLog’s are used.
			</>
		);
	} else {
		status = (
			<>
				Team {teamNumber}’s colors from {source}
			</>
		);
	}
	return (
		<Text type="supporting" color="secondary" role="status">
			{status}
		</Text>
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
