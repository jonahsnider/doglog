# app-shell Specification

## Purpose

Define the overall layout of DogLog Studio: a vertical sidebar on the left for choosing the data source, auxiliary pages, and dashboards, with the selected item shown in the main area.

## Requirements

### Requirement: Sidebar layout

The app SHALL show a vertical sidebar on the left containing, from top to bottom: the source control, a pages section, and a dashboards section.

#### Scenario: Sidebar sections

- **WHEN** the user opens Studio
- **THEN** the sidebar shows the source control at the top
- **AND** the pages section below it
- **AND** the dashboards section below the pages section

### Requirement: Window colors

Like VS Code's Peacock extension, the top of the sidebar SHALL be tinted to tell open Studio tabs and windows apart. The first window MUST keep the default color, and each additional window MUST take the next chart color in order, repeating after the last. A window MUST keep its color while it's open, and a newly opened window MUST take the first color no open window is using.

#### Scenario: Open a second window

- **GIVEN** Studio is open in one window
- **WHEN** the user opens Studio in another window
- **THEN** the first window's sidebar is unchanged
- **AND** the top of the second window's sidebar is tinted with the first chart color

#### Scenario: Reuse a closed window's color

- **GIVEN** Studio is open in three windows
- **WHEN** the user closes the second window and opens a new one
- **THEN** the new window takes the color the closed window had

### Requirement: Pages section

The pages section SHALL list the auxiliary pages Logs and Settings, and selecting a page MUST show it in the main area.

#### Scenario: Open Settings

- **WHEN** the user selects Settings in the sidebar
- **THEN** the Settings page is shown in the main area
- **AND** Settings is marked as the selected sidebar item

#### Scenario: Open Logs

- **WHEN** the user selects Logs in the sidebar
- **THEN** the Logs page is shown, where the user manages log sync and opens synced logs

### Requirement: Dashboards section

The dashboards section SHALL always list the user's dashboards, regardless of which page or dashboard is currently shown.

#### Scenario: Open a dashboard from a page

- **GIVEN** the Settings page is shown
- **WHEN** the user selects a dashboard in the sidebar
- **THEN** that dashboard is shown in the main area

#### Scenario: Switch between dashboards

- **GIVEN** a dashboard is shown
- **WHEN** the user selects a different dashboard in the sidebar
- **THEN** the selected dashboard is shown
- **AND** the active data source and timeline cursor are unchanged

### Requirement: Dashboard view chrome

When a dashboard is shown, the main area SHALL show the dashboard's panes, a collapsible entry browser panel on the right, and the timeline bar along the bottom.

#### Scenario: Dashboard view with an active source

- **GIVEN** a data source is active
- **WHEN** the user opens a dashboard
- **THEN** the dashboard's panes fill the main area
- **AND** the timeline bar is shown along the bottom of the dashboard area

#### Scenario: Pages hide dashboard chrome

- **WHEN** the user opens the Settings page
- **THEN** the timeline bar and entry browser are not shown

### Requirement: Collapsible sidebar

Users SHALL be able to collapse the sidebar to a narrow icon-only rail and expand it again. Hovering the collapsed rail MUST temporarily expand it over the dashboard without resizing the dashboard, and the collapsed state MUST persist.

#### Scenario: Collapse for more space

- **WHEN** the user collapses the sidebar
- **THEN** it shrinks to an icon-only rail
- **AND** the dashboard area grows to use the freed space

#### Scenario: Peek on hover

- **GIVEN** the sidebar is collapsed
- **WHEN** the user hovers the rail
- **THEN** the full sidebar is shown over the dashboard
- **AND** the dashboard layout does not change

#### Scenario: Remember collapsed state

- **GIVEN** the user collapsed the sidebar
- **WHEN** Studio is reopened
- **THEN** the sidebar is still collapsed

#### Scenario: Toggle instantly with the keyboard

- **WHEN** the user toggles the sidebar with its keyboard shortcut
- **THEN** it collapses or expands without animating
- **AND** toggling it by clicking still animates

### Requirement: Context menus

Context menus SHALL be shown as native operating system menus in the desktop app and as in-app menus on the web, with the same items on both.

#### Scenario: Desktop context menu

- **GIVEN** the user is using the desktop app
- **WHEN** the user right-clicks a dashboard in the sidebar
- **THEN** a native menu is shown

#### Scenario: Web context menu

- **GIVEN** the user is using the web app
- **WHEN** the user right-clicks a dashboard in the sidebar
- **THEN** an in-app menu with the same items is shown

### Requirement: Menu items are text only

Items in context menus and dropdown menus SHALL NOT show icons, so in-app menus match native menus and stay easy to scan.

#### Scenario: Open a dropdown menu

- **WHEN** the user opens the dashboard options menu in the sidebar
- **THEN** each item shows only its label and keyboard shortcut, if any

#### Scenario: Open a context menu on the web

- **GIVEN** the user is using the web app
- **WHEN** the user right-clicks a dashboard pane
- **THEN** each item shows only its label and keyboard shortcut, if any
