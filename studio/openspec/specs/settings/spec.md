# settings Specification

## Purpose

Define the Settings page, where users choose the color theme and the robot connection target, with all settings persisted locally on the device.

## Requirements

### Requirement: Theme setting

Settings SHALL let users choose a light, dark, or system color theme.

#### Scenario: Follow system

- **GIVEN** the theme is set to system
- **WHEN** the operating system switches to dark mode
- **THEN** Studio switches to the dark theme

### Requirement: Robot connection setting

Settings SHALL let users set the robot connection target as a team number or an IP address.

#### Scenario: Team number

- **WHEN** the user enters team number 581
- **THEN** Connect to robot targets the standard robot address for team 581

#### Scenario: IP address

- **WHEN** the user enters `10.5.81.2`
- **THEN** Connect to robot targets `10.5.81.2`

### Requirement: Persisted settings

Settings and UI state MUST be saved on the device and restored when Studio reopens.

#### Scenario: Restore settings

- **GIVEN** the user set the theme to light
- **WHEN** Studio is reopened
- **THEN** the light theme is used

### Requirement: Theme color setting

Settings SHALL let users choose the theme color that the color scheme is generated from, defaulting to Team 581 maroon `#591616`, and MUST let users reset it to the default.

#### Scenario: Custom color

- **WHEN** the user picks a blue theme color
- **THEN** Studio's light and dark themes are regenerated from that blue

#### Scenario: Reset

- **GIVEN** the user picked a custom theme color
- **WHEN** the user resets it
- **THEN** the theme color is `#591616` again
