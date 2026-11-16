# theming Specification

## Purpose

Define Studio's visual identity: a Material Design 3 color scheme generated from a theme color (Team 581 maroon by default) or a neutral gray scheme, available in both light and dark variants.

## Requirements

### Requirement: Generated color scheme

Unless the Neutral preset is selected, Studio SHALL generate its colors from the theme color setting as a Material Design 3 color scheme (primary, surface, container, and similar roles). The default theme color MUST be Team 581 maroon `#591616`.

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

### Requirement: Series colors

The theme SHALL provide 5 series colors for widgets that color entries, and every series color MUST be distinguishable from the others in both light and dark variants.

#### Scenario: Five entries in light theme

- **GIVEN** the light theme is active
- **WHEN** a widget colors 5 entries
- **THEN** each entry has a visibly different color
