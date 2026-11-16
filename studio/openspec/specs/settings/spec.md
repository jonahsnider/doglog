# settings Specification

## Purpose

Define the Settings page, where users choose the color theme, the robot connection target, and whether media controls control playback, with all settings persisted locally on the device.

## Requirements

### Requirement: Theme setting

Settings SHALL let users choose a light, dark, or system color theme, and each option MUST show a preview of Studio in that theme.

#### Scenario: Follow system

- **GIVEN** the theme is set to system
- **WHEN** the operating system switches to dark mode
- **THEN** Studio switches to the dark theme

### Requirement: Robot connection setting

Settings SHALL let users set the robot connection target as a team number or an IP address.

#### Scenario: Team number

- **WHEN** the user enters team number 581
- **THEN** Connect targets the standard robot address for team 581

#### Scenario: IP address

- **WHEN** the user enters `10.5.81.2`
- **THEN** Connect targets `10.5.81.2`

### Requirement: Media controls setting

Settings SHALL let users turn media controls for log playback on or off, defaulting to off.

#### Scenario: Default

- **WHEN** Studio is opened for the first time
- **THEN** media controls are off

### Requirement: Persisted settings

Settings and UI state MUST be saved on the device and restored when Studio reopens.

#### Scenario: Restore settings

- **GIVEN** the user set the theme to light
- **WHEN** Studio is reopened
- **THEN** the light theme is used

### Requirement: Theme color setting

Settings SHALL let users choose a theme color preset of Team 581 maroon, match13, Neutral, or Custom, defaulting to Team 581 maroon. Each preset MUST show a preview of its light and dark colors. Custom MUST let users pick any color, defaulting to `#1c1816`, and reset it to the default, and MUST keep the picked color while another preset is selected.

#### Scenario: Custom color

- **GIVEN** Custom is selected
- **WHEN** the user picks a blue color
- **THEN** Studio's light and dark themes are regenerated from that blue

#### Scenario: Keep custom color

- **GIVEN** the user picked a blue custom color
- **WHEN** the user selects Neutral and then Custom again
- **THEN** the custom color is still blue

#### Scenario: Reset

- **GIVEN** the user picked a custom color
- **WHEN** the user resets it
- **THEN** the custom color is `#1c1816` again
