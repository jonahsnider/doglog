# theming Specification

## Purpose

Define Studio's visual identity: a Material Design 3 color scheme generated from a theme color (Team 581 maroon by default) or from untinted grays, available in both light and dark variants, and consistent motion.

## Requirements

### Requirement: Generated color scheme

Studio SHALL generate a Material Design 3 Tonal Spot scheme using the 2025 spec. The default Team 581 preset MUST use seed `#591616` and HCT chroma 1 and 2 in light mode and 2 and 3.5 in dark mode for the neutral and neutral variant palettes, respectively. The MD3 contrast level MUST be 0 for Standard, 0.5 for Medium, and 1 for High.

#### Scenario: Default color

- **GIVEN** the Team 581 preset is selected
- **WHEN** the user views Studio in light or dark mode
- **THEN** neutral surfaces have a subtler maroon tint than stock Tonal Spot
- **AND** primary actions keep the stock maroon-derived accent

### Requirement: match13 palette

The match13 preset MUST retain its `#1a7ccd` seed. Its primary, secondary, and neutral palette inputs MUST be `#135ab0`, `#cddff8`, and `#e2efff` in light mode and `#6ab0fd`, `#273e55`, and `#000000` in dark mode. Dark primary actions and focus rings MUST use the site's `sky-400` (`#29a3f6`) at Standard contrast and lighter tones at Medium and High. Primary labels MUST retain MD3's contrast targets.

#### Scenario: match13 colors

- **GIVEN** the match13 preset is selected
- **WHEN** the user switches from light to dark mode
- **THEN** the surfaces switch from pale blue to near-black charcoal
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

FrogLog SHALL use leaf green for its primary palette and soft stream blue for its secondary palette. Both palettes MUST follow the selected light or dark appearance and contrast setting.

#### Scenario: FrogLog accents

- **GIVEN** FrogLog is selected
- **WHEN** the user views Studio in light or dark mode
- **THEN** primary actions use green and selected sidebar items use blue

### Requirement: Neutral colors

The Neutral preset SHALL generate its scheme from untinted gray palettes in place of the primary, secondary, neutral, and neutral variant palettes, so surfaces, borders, and primary actions have no hue. Its series, status, and band colors MUST be generated from a fixed blue, since gray has no hue to start from.

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

Studio SHALL tint a native backdrop with the theme's frame color on macOS (Liquid Glass on macOS 26 and later, sidebar vibrancy on macOS 15) and Windows 11 22H2 and later (Desktop Acrylic). The backdrop SHALL show through the frame, including under the sidebars and the timeline, which sit on it; panes and pages SHALL stay opaque. Studio SHALL use a solid frame when a native backdrop is unavailable or the system requests reduced transparency or forced colors.

#### Scenario: Native backdrop is available

- **GIVEN** Studio is running on macOS or Windows 11 22H2 or later with transparency enabled
- **WHEN** the user views a dashboard
- **THEN** the native backdrop is visible between panes, at their outer edges, and under the sidebars and timeline, not through the panes

#### Scenario: Native backdrop is unavailable or disabled

- **WHEN** Studio runs without a supported native backdrop or the system disables transparency
- **THEN** the frame is solid in the current theme

### Requirement: Status colors

The theme SHALL provide success, info, warning, and test mode status colors, each with a lighter fill for icons and backgrounds and a text color readable on surfaces. They MUST be generated from fixed hues the way MD3 custom colors are: success, info, and test mode are nudged toward the theme color's hue, while warning keeps its amber hue so it never looks like the error color.

#### Scenario: Themed status colors

- **GIVEN** the Team 581 preset is selected
- **WHEN** the user views a success badge
- **THEN** it's green, nudged slightly toward the maroon theme color

### Requirement: Series colors

The theme SHALL provide 5 distinguishable series colors in light and dark. Default MUST space the hues evenly starting from the theme hue, at the same lightness. Protan, deutan, and tritan MUST use fixed light and dark palettes checked under the corresponding color vision simulation. They MUST NOT change logged colors or the game field.

#### Scenario: Five entries in light theme

- **GIVEN** the light theme is active
- **WHEN** a widget colors 5 entries
- **THEN** each entry has a visibly different color

#### Scenario: Themed series colors

- **GIVEN** the match13 preset and Default visualization colors are selected
- **WHEN** a widget colors entries
- **THEN** the first entry is blue, matching match13's theme color

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
