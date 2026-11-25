# theming Specification

## Purpose

Define Studio's visual identity: Astryx color tokens generated from a preset's seed colors (the DogLog preset by default) or from untinted grays, available in both light and dark variants, and consistent motion.

## Requirements

### Requirement: Generated color scheme

Studio SHALL generate its color tokens with Astryx's palette generator (`astryx-oklch-v2`) from each preset's accent, neutral, and status seeds. The default DogLog preset MUST use accent `#591616` and neutral `#6f6564`.

#### Scenario: Default color

- **GIVEN** the DogLog preset is selected
- **WHEN** the user views Studio in light or dark mode
- **THEN** neutral surfaces have a subtle maroon tint
- **AND** primary actions use the maroon accent

### Requirement: High contrast

Studio SHALL use the palette generator's own mapping unless the High contrast setting is on or the system asks for more contrast. High contrast MUST follow the generator's tone-based high contrast rules on the same neutral ramp: secondary text and icons move 10 stops toward contrast, translucent borders become twice as opaque, and emphasized borders start mid-scale and move toward contrast until they reach 3:1 against surfaces. Secondary text MUST keep at least 4.5:1 against surfaces either way.

#### Scenario: High contrast borders

- **GIVEN** any preset is selected
- **WHEN** the user turns on High contrast, or the system asks for more contrast
- **THEN** borders and secondary text get stronger, while surfaces and accents stay the same

### Requirement: match13 palette

The match13 preset MUST use accent `#135ab0` and neutral `#e2efff` in light mode, and the site's `sky-400` (`#29a3f6`) accent with its `#111827` card color as the neutral in dark mode. Selected items MUST use the site's `#cddff8` sticky header color in light mode and `#273e55` panel color in dark mode.

#### Scenario: match13 colors

- **GIVEN** the match13 preset is selected
- **WHEN** the user switches from light to dark mode
- **THEN** the surfaces switch from pale blue to navy
- **AND** primary actions switch from deep blue to bright blue
- **AND** selected sidebar items stay blue-tinted in both modes

### Requirement: Themed progress decoration

The skiing mascot SHALL ride the leading edge of the progress fill when loading a log or saving a video in the match13 preset. The mascot MUST be decorative and MUST NOT change the progress value, label, or cancellation behavior. Other presets MUST show the standard progress track.

#### Scenario: Reduced motion

- **GIVEN** the match13 preset is selected and reduced motion is enabled
- **WHEN** Studio shows a progress bar for loading a log or saving a video
- **THEN** the mascot moves without animation when the progress value changes
- **AND** the mascot is hidden when progress is indeterminate

### Requirement: FrogLog palette

FrogLog SHALL use leaf green (`#79b748`) for its accent and soft stream blue (`#9ed8f7`) for selected items, each following the selected light or dark appearance.

#### Scenario: FrogLog accents

- **GIVEN** FrogLog is selected
- **WHEN** the user views Studio in light or dark mode
- **THEN** primary actions use green and selected sidebar items use blue

### Requirement: HogLog palette

HogLog SHALL follow MD3's tonal spot scheme (2025 spec) for `#ffbbcc`: its primary as the accent, its secondary container for selected items, and neutrals tinted like its surfaces. Light surfaces MUST be visibly pink, and dark surfaces MUST stay near gray rather than a saturated pink.

#### Scenario: HogLog colors

- **GIVEN** HogLog is selected
- **WHEN** the user switches from light to dark mode
- **THEN** surfaces switch from pale pink to a pink-tinted charcoal
- **AND** primary actions switch from deep rose to pastel pink

### Requirement: Neutral colors

The Neutral preset SHALL generate its colors from gray accent and neutral seeds, so surfaces, borders, and primary actions have no hue.

#### Scenario: Neutral primary actions

- **GIVEN** the Neutral preset is selected
- **WHEN** the user views primary actions such as New dashboard
- **THEN** they use a gray primary color instead of a maroon tint

### Requirement: Light and dark variants

The theme SHALL have both light and dark variants derived from the same color scheme.

#### Scenario: Switch variant

- **WHEN** the user switches from dark to light theme
- **THEN** every surface, text, and widget color switches to the light variant
- **AND** status colors remain distinguishable

### Requirement: Window frame backdrop

Studio SHALL tint a native backdrop with the theme's frame color on macOS (Liquid Glass on macOS 26 and later, sidebar vibrancy on macOS 15) and Windows 11 22H2 and later (Desktop Acrylic). The backdrop SHALL show through the frame, including under the sidebars and timeline; panes and pages SHALL stay opaque. The frame SHALL be solid without a native backdrop, with forced colors, or when the system or the setting reduces transparency.

#### Scenario: Native backdrop is available

- **GIVEN** Studio is running on macOS or Windows 11 22H2 or later with transparency enabled
- **WHEN** the user views a dashboard
- **THEN** the native backdrop is visible between panes, at their outer edges, and under the sidebars and timeline, not through the panes

#### Scenario: Native backdrop is unavailable or disabled

- **WHEN** Studio runs without a supported native backdrop, the system disables transparency, or the reduce transparency setting is on
- **THEN** the frame is solid in the current theme

### Requirement: Status colors

The theme SHALL provide success, info, warning, and error status colors, each with a fill for icons and backgrounds and a text color readable on surfaces, and a test mode fill. They MUST be generated from the same fixed seeds in every preset, so they keep their meaning next to any theme color.

#### Scenario: Status colors in any preset

- **GIVEN** any preset is selected
- **WHEN** the user views a success badge
- **THEN** it's the same green as in every other preset

### Requirement: Series colors

The theme SHALL provide 5 distinguishable series colors in light and dark, each with a darker outline from its own ramp (lighter for fills near black). Default MUST use Astryx's categorical data colors in their order, leaving out colors under 3:1 against light or dark panes and red, which reads as an error. Protan, deutan, and tritan MUST use fixed light and dark palettes checked under the corresponding color vision simulation. They MUST NOT change logged colors or the game field.

#### Scenario: Five entries in light theme

- **GIVEN** the light theme is active
- **WHEN** a widget colors 5 entries
- **THEN** each entry has a visibly different color

#### Scenario: Series colors in any preset

- **GIVEN** Default visualization colors are selected
- **WHEN** the user switches between presets
- **THEN** widgets keep the same series colors, starting with Astryx's blue

### Requirement: Motion

Studio SHALL animate with the design system's easing curves and durations, so similar changes move the same way everywhere. State changes MUST use the standard curve, things moving within the screen the move curve, and things entering the entrance curve. Things leaving MUST accelerate on the exit curve.

#### Scenario: Close a pane

- **WHEN** the user closes one of two panes
- **THEN** the closed pane speeds up as it shrinks away, faster than a new pane grows in when splitting

### Requirement: Reduced motion

Studio SHALL reduce motion when the system is set to reduce motion or the reduce motion setting is on, and wherever a spec says the system reduces motion, the setting MUST have the same effect. Layout changes like splitting, closing, and zooming panes, opening and closing dashboards in the sidebar, and collapsing the sidebar MUST happen instantly.

#### Scenario: Reduced motion

- **GIVEN** the system is set to reduce motion
- **WHEN** the user splits a pane
- **THEN** the new pane appears at its full size without animating
