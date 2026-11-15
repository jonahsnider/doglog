# theming Specification

## Purpose

Define Studio's visual identity: Team 581 colors based on a slightly tweaked Material Design 3 color scheme, available in both light and dark variants.

## Requirements

### Requirement: Team 581 color scheme

Studio SHALL use Team 581 theme tokens following Material Design 3 color roles (primary, surface, container, and similar roles).

#### Scenario: Brand color

- **WHEN** the user views primary actions such as New dashboard
- **THEN** they use the Team 581 primary color

### Requirement: Light and dark variants

The theme SHALL have both light and dark variants derived from the same color scheme.

#### Scenario: Switch variant

- **WHEN** the user switches from dark to light theme
- **THEN** every surface, text, and widget color switches to the light variant
- **AND** status colors remain distinguishable
