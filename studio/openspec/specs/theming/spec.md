# theming Specification

## Purpose

Define Studio's visual identity: a Material Design 3 color scheme generated from a theme color (Team 581 maroon by default), available in both light and dark variants.

## Requirements

### Requirement: Generated color scheme

Studio SHALL generate its colors from the theme color setting as a Material Design 3 color scheme (primary, surface, container, and similar roles). The default theme color MUST be Team 581 maroon `#591616`.

#### Scenario: Default color

- **GIVEN** the theme color is the default
- **WHEN** the user views primary actions such as New dashboard
- **THEN** they use the Team 581 maroon primary color

### Requirement: Light and dark variants

The theme SHALL have both light and dark variants derived from the same color scheme.

#### Scenario: Switch variant

- **WHEN** the user switches from dark to light theme
- **THEN** every surface, text, and widget color switches to the light variant
- **AND** status colors remain distinguishable
