# theming Specification

## Purpose

Define Studio's visual identity: a Material Design 3 color scheme generated from a theme color (Team 581 maroon by default) or a neutral gray scheme, available in both light and dark variants, and consistent motion.

## Requirements

### Requirement: Generated color scheme

Unless the Neutral preset is selected, Studio SHALL generate its colors from the theme color setting as a Material Design 3 tonal spot color scheme using the 2025 spec (primary, surface, container, and similar roles). The default theme color MUST be Team 581 maroon `#591616`. The match13 preset MUST use match13's blue `#1a7ccd`, with white `#ffffff` as the secondary color. The scheme MUST use the MD3 contrast level for the contrast setting: 0 for standard, 0.5 for medium, and 1 for high.

#### Scenario: Default color

- **GIVEN** the theme color is the default
- **WHEN** the user views primary actions such as New dashboard
- **THEN** they use the Team 581 maroon primary color

### Requirement: Neutral colors

When the Neutral preset is selected, Studio SHALL use untinted gray colors instead of a generated scheme.

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

### Requirement: Status colors

The theme SHALL provide success, info, warning, and test mode status colors, each with a lighter fill for icons and backgrounds and a text color readable on surfaces. Unless the Neutral preset is selected, they MUST be generated from fixed hues the way MD3 custom colors are: success, info, and test mode are nudged toward the theme color's hue, while warning keeps its amber hue so it never looks like the error color.

#### Scenario: Themed status colors

- **GIVEN** the Team 581 preset is selected
- **WHEN** the user views a success badge
- **THEN** it's green, nudged slightly toward the maroon theme color

### Requirement: Series colors

The theme SHALL provide 5 series colors for widgets that color entries, and every series color MUST be distinguishable from the others in both light and dark variants. Unless the Neutral preset is selected, the series colors MUST be generated from the theme color: the first takes the theme color's hue, the rest are spaced evenly around the hue wheel, and all share one lightness so each contrasts equally with the background.

#### Scenario: Five entries in light theme

- **GIVEN** the light theme is active
- **WHEN** a widget colors 5 entries
- **THEN** each entry has a visibly different color

#### Scenario: Themed series colors

- **GIVEN** the match13 preset is selected
- **WHEN** a widget colors entries
- **THEN** the first entry is blue, matching match13's theme color

### Requirement: Motion

Studio SHALL animate with one set of Material Design 3 easing curves and durations, so similar changes move the same way everywhere. Things moving within the screen MUST use the standard curve, things entering MUST decelerate, and things leaving MUST accelerate and finish sooner. When the system is set to reduce motion, layout changes like splitting, closing, and zooming panes, opening and closing dashboards in the sidebar, and collapsing the sidebar MUST happen instantly.

#### Scenario: Close a pane

- **WHEN** the user closes one of two panes
- **THEN** the closed pane speeds up as it shrinks away, faster than a new pane grows in when splitting

#### Scenario: Reduced motion

- **GIVEN** the system is set to reduce motion
- **WHEN** the user splits a pane
- **THEN** the new pane appears at its full size without animating
