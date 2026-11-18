# app-shell Specification

## Purpose

Define the overall layout of DogLog Studio: a vertical sidebar on the left for choosing the data source, auxiliary pages, and dashboards, with the selected item shown in the main area.

## Requirements

### Requirement: Sidebar layout

The app SHALL show a vertical sidebar on the left containing, from top to bottom: the sidebar toggle, the source control, a pages section, and a Dashboards section. Sections MUST be set apart by spacing and muted labels instead of divider lines.

#### Scenario: Sidebar sections

- **WHEN** the user opens Studio
- **THEN** the sidebar shows the sidebar toggle at the top
- **AND** the source control below it
- **AND** the pages section below the source control
- **AND** the Dashboards section, labeled "Dashboards", below the pages section

### Requirement: What's new

The bottom of the sidebar SHALL show a card announcing the newest product update until the user dismisses it. Dismissing it MUST hide the update, and it MUST stay hidden in other windows and after Studio is reopened. Users opening Studio for the first time MUST NOT see updates released before then.

#### Scenario: New update

- **GIVEN** an update was released since the user last dismissed the card
- **WHEN** the user opens Studio
- **THEN** the bottom of the sidebar shows the update's title and description

#### Scenario: Dismiss an update

- **GIVEN** the sidebar shows an update
- **WHEN** the user dismisses it
- **THEN** the card is hidden
- **AND** it isn't shown again until a newer update is released

#### Scenario: First launch

- **WHEN** the user opens Studio for the first time
- **THEN** no update is shown

#### Scenario: Collapsed sidebar

- **GIVEN** the sidebar is collapsed
- **AND** there's an update the user hasn't dismissed
- **THEN** the rail shows a What's new icon instead of the card
- **WHEN** the user selects the icon
- **THEN** the full sidebar is shown over the dashboard with the card

### Requirement: Window colors

The top of the sidebar SHALL be tinted to tell open Studio tabs and windows apart. The first window MUST keep the default color, and each additional window MUST take the next chart color in order, repeating after the last. A window MUST keep its color while it's open, and a newly opened window MUST take the first color no open window is using.

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

The dashboards section SHALL always list the user's dashboards, regardless of which page or dashboard is currently shown. Shared dashboards are listed last, in their own Shared section (see the shared-dashboards spec).

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

Users SHALL be able to collapse the sidebar to a narrow icon-only rail and expand it again. An icon-only toggle button at the top of the sidebar MUST stay in place in both states, named by a tooltip with its keyboard shortcut. Hovering the collapsed rail MUST temporarily expand it over the dashboard without resizing the dashboard, and the collapsed state MUST persist.

#### Scenario: Collapse for more space

- **WHEN** the user collapses the sidebar
- **THEN** it shrinks to an icon-only rail
- **AND** the dashboard area grows to use the freed space
- **AND** the toggle stays at the top, with a tooltip reading "Expand sidebar"

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

### Requirement: Navigation history

Like a browser, Back and Forward SHALL move through the pages the user visited in the window. They MUST always change the page, skipping dashboards that have since been closed and visits to the page already shown, and be disabled when there's nowhere to go.

#### Scenario: Go back

- **GIVEN** the user opened Settings, then a dashboard
- **WHEN** the user presses Back
- **THEN** Settings is shown
- **AND** pressing Forward shows the dashboard again

#### Scenario: Skip a closed dashboard

- **GIVEN** the user opened dashboard A, then dashboard B, then dashboard C
- **AND** B has been closed
- **WHEN** the user presses Back
- **THEN** A is shown

#### Scenario: Skip the page already shown

- **GIVEN** the user opened Settings, then dashboard A
- **AND** opened a new dashboard and closed it, which showed A again
- **WHEN** the user presses Back
- **THEN** Settings is shown

#### Scenario: Nowhere to go

- **GIVEN** the user hasn't gone back
- **THEN** Forward is disabled

### Requirement: macOS title bar

The macOS desktop app SHALL draw the window controls over the top of the sidebar instead of showing a title bar, so the main area reaches the top of the window. The sidebar toggle MUST be shown beside the window controls, along with Back and Forward buttons, and the top of the sidebar MUST be draggable like a title bar. The expanded sidebar MUST be wide enough to show the app's name between the toggle and Back.

#### Scenario: Sidebar expanded

- **GIVEN** the user is using the desktop app on macOS
- **THEN** the window controls are shown at the top of the sidebar
- **AND** the sidebar toggle is shown after them, followed by the app's name, Back, and Forward

#### Scenario: Sidebar collapsed

- **GIVEN** the user is using the desktop app on macOS
- **WHEN** the user collapses the sidebar
- **THEN** the sidebar toggle, Back, and Forward buttons stay beside the window controls
- **AND** the top left pane's header makes room for the window controls and the buttons, which are wider than the rail

#### Scenario: Page titles

- **GIVEN** the user is using the desktop app on macOS
- **WHEN** the user toggles the sidebar on a page like Logs or Settings
- **THEN** the page title stays below the window controls and doesn't move

#### Scenario: Fullscreen

- **GIVEN** the user is using the desktop app on macOS
- **WHEN** the window is fullscreen
- **THEN** the space for the window controls is removed

### Requirement: Context menus

Context menus SHALL be shown as native operating system menus in the desktop app and as in-app menus on the web, with the same items on both.

#### Scenario: Desktop context menu

- **GIVEN** the user is using the desktop app
- **WHEN** the user right-clicks a dashboard in the sidebar
- **THEN** a native menu is shown

#### Scenario: Desktop dashboard options menu

- **GIVEN** the user is using the desktop app
- **WHEN** the user clicks a dashboard's options button in the sidebar
- **THEN** the same native menu is shown beside the button

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
