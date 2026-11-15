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

### Requirement: Pages section

The pages section SHALL list the auxiliary pages Logs and Settings, and selecting a page MUST show it in the main area.

#### Scenario: Open Settings

- **WHEN** the user selects Settings in the sidebar
- **THEN** the Settings page is shown in the main area
- **AND** Settings is marked as the selected sidebar item

#### Scenario: Logs placeholder

- **WHEN** the user views the pages section
- **THEN** Logs is visible but marked as not yet available
- **AND** selecting it does not offer any log sync functionality

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

When a dashboard is shown, the main area SHALL show the dashboard's panes, a collapsible key browser panel on the right, and the timeline bar along the bottom.

#### Scenario: Dashboard view with an active source

- **GIVEN** a data source is active
- **WHEN** the user opens a dashboard
- **THEN** the dashboard's panes fill the main area
- **AND** the timeline bar is shown along the bottom of the dashboard area

#### Scenario: Pages hide dashboard chrome

- **WHEN** the user opens the Settings page
- **THEN** the timeline bar and key browser are not shown
