# settings Specification

## Purpose

Define the Settings page, where users choose the color theme and contrast, whether to reduce motion, their name, the robot connection target, and whether media controls control playback, with all settings persisted locally on the device. The page also shows which version of Studio is running.

## Requirements

### Requirement: Settings sections

Settings SHALL group related settings under titled sections, in this order: Appearance (theme and theme color), Accessibility (contrast and reduce motion), Robot (robot connection), Sharing (name), and System (media controls, natural scrolling, the terminal command, and coding agents).

#### Scenario: Find the theme

- **WHEN** the user opens Settings
- **THEN** the theme and theme color settings are under Appearance
- **AND** the contrast and reduce motion settings are under Accessibility

### Requirement: Theme setting

Settings SHALL let users choose a light, dark, or system color theme, and each option MUST show a preview of Studio in that theme.

#### Scenario: Follow system

- **GIVEN** the theme is set to system
- **WHEN** the operating system switches to dark mode
- **THEN** Studio switches to the dark theme

### Requirement: Name setting

Settings SHALL let users set the name others see in shared dashboards. While it's blank, it MUST show the anonymous name others see instead.

#### Scenario: Set a name

- **WHEN** the user sets their name to Jonah
- **THEN** others in shared dashboards see them as Jonah

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

### Requirement: Natural scrolling setting

Where the browser doesn't report whether the system uses natural scrolling, Settings SHALL let users say whether it does, defaulting to on, so scrolling the timeline follows their fingers. Where the browser reports it, like Safari and the desktop app on macOS, the setting MUST be hidden and the reported direction used.

#### Scenario: Natural scrolling off

- **GIVEN** the browser doesn't report the scroll direction
- **AND** the user turned natural scrolling off
- **WHEN** the user swipes right over the timeline bar
- **THEN** the cursor moves right

### Requirement: Persisted settings

Settings and UI state MUST be saved on the device and restored when Studio reopens. Settings MUST be shared by every open Studio tab or window, so a change in one appears in the others immediately. Each tab or window MUST keep its own data source, timeline, and layout UI state, like whether the sidebar is collapsed, with the most recent change used when a new window opens or Studio reopens.

#### Scenario: Restore settings

- **GIVEN** the user set the theme to light
- **WHEN** Studio is reopened
- **THEN** the light theme is used

#### Scenario: Change settings in another tab

- **GIVEN** Studio is open in two tabs
- **WHEN** the user sets the theme to light in one tab
- **THEN** the other tab switches to the light theme

#### Scenario: Collapse the sidebar in another tab

- **GIVEN** Studio is open in two tabs
- **WHEN** the user collapses the sidebar in one tab
- **THEN** the other tab's sidebar stays expanded
- **AND** a newly opened tab starts with the sidebar collapsed

### Requirement: Theme color setting

Settings SHALL let users choose a theme color preset of Team 581 maroon, match13, Neutral, or Custom, defaulting to Team 581 maroon. Each preset MUST show circular previews of its light and dark colors. When the presets don't fit, the row MUST scroll horizontally rather than shrinking the previews. Custom MUST let users pick any color, defaulting to `#1c1816`, and reset it to the default, and MUST keep the picked color while another preset is selected.

#### Scenario: Custom color

- **GIVEN** Custom is selected
- **WHEN** the user picks a blue color
- **THEN** Studio's light and dark themes are regenerated from that blue

#### Scenario: Keep custom color

- **GIVEN** the user picked a blue custom color
- **WHEN** the user selects Neutral and then Custom again
- **THEN** the custom color is still blue

#### Scenario: Removed preset

- **GIVEN** a preset that no longer exists is saved
- **WHEN** Studio loads the settings
- **THEN** Team 581 maroon is selected and the custom color is kept

#### Scenario: Reset

- **GIVEN** the user picked a custom color
- **WHEN** the user resets it
- **THEN** the custom color is `#1c1816` again

### Requirement: Contrast setting

Settings SHALL let users choose standard, medium, or high contrast for generated color schemes, defaulting to standard.

#### Scenario: High contrast

- **GIVEN** the Team 581 maroon preset is selected
- **WHEN** the user selects high contrast
- **THEN** Studio's light and dark themes are regenerated at high contrast

### Requirement: Reduce motion setting

Settings SHALL let users turn reduce motion on or off, defaulting to off. While it's on, Studio MUST reduce motion everywhere it would when the system is set to reduce motion. While it's off, Studio MUST still follow the system.

#### Scenario: Reduce motion without the system setting

- **GIVEN** the system isn't set to reduce motion
- **WHEN** the user turns reduce motion on and splits a pane
- **THEN** the new pane appears at its full size without animating

#### Scenario: System reduces motion

- **GIVEN** the system is set to reduce motion
- **AND** reduce motion is off in Settings
- **WHEN** the user splits a pane
- **THEN** the new pane appears at its full size without animating

### Requirement: Version info

Settings SHALL show the running Studio version and, when Studio was built from a Git repository, the short hash of the commit it was built from. The version info SHALL sit at the bottom of the page, below the settings, even when the settings are shorter than the window.

#### Scenario: Built from Git

- **GIVEN** Studio version 2026.1.0 was built from commit `9867e24`
- **WHEN** the user opens Settings
- **THEN** Settings shows version 2026.1.0 and commit `9867e24`

### Requirement: Project links

Settings SHALL link to the DogLog GitHub repository and to the author's website next to the version info.

#### Scenario: Open a link on desktop

- **GIVEN** the user is using the desktop app
- **WHEN** the user clicks the GitHub link in Settings
- **THEN** the repository opens in the system's default browser
