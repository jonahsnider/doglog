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

### Requirement: Sidebar footer actions

The sidebar footer SHALL offer Keyboard shortcuts, Download app, and Check for updates when the sidebar is expanded or peeking. These actions MUST NOT appear in the collapsed rail. When an update is ready, Check for updates MUST become the install action in the same row without moving the other actions or losing focus. The install action MUST remain available in the rail.

#### Scenario: Open keyboard shortcuts

- **WHEN** the user selects Keyboard shortcuts in the footer
- **THEN** Studio opens the same list as the keyboard shortcut

#### Scenario: Download an installer in the web app

- **GIVEN** Studio is running in a browser
- **WHEN** the user opens Download app
- **THEN** the menu lists the macOS Apple silicon and Intel, Windows, Linux AppImage, and Linux .deb installers
- **AND** selecting an installer downloads it

#### Scenario: Copy an installer link in the desktop app

- **GIVEN** Studio is running in the desktop app
- **WHEN** the user opens Download app
- **THEN** the menu lists the same installers
- **AND** selecting an installer copies its download URL without starting a download
- **AND** Studio confirms whether the link was copied

#### Scenario: Check for updates

- **WHEN** the user selects Check for updates in the footer
- **THEN** Studio checks for a newer version and reports the result without installing anything

#### Scenario: Collapse the sidebar with What's new visible

- **GIVEN** the What's new card is visible
- **WHEN** the sidebar animates into the rail
- **THEN** the expanded-only actions fade out without moving the card
- **AND** the actions stop taking up space once the sidebar reaches the rail layout

### Requirement: Footer actions on hover

On devices with hover, the sidebar footer actions SHALL stay hidden until the sidebar is hovered, has keyboard focus, or has one of its menus or dialogs open, and MUST keep their space while hidden so the sidebar's other items don't move. An install action for a ready update MUST stay visible.

#### Scenario: Reveal the footer actions

- **GIVEN** the sidebar is expanded and no update is ready
- **WHEN** the pointer moves over the sidebar
- **THEN** Keyboard shortcuts, Download app, and Check for updates fade in
- **AND** they fade out once the pointer leaves, unless one of their menus or dialogs is open

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

### Requirement: Window titles

Each Studio tab and window SHALL be titled after what it shows, so they can be told apart wherever the browser or system lists them: the dashboard's name or the page, then the source's name in parentheses, then "DogLog Studio". Parts that don't apply MUST be left out. Log names MUST leave out their `.wpilog` or `.wpilogxz` extension. The macOS desktop app MUST leave out "DogLog Studio", since macOS already groups windows by app. The title MUST update when the dashboard, page, or source changes.

#### Scenario: Two windows on the same log

- **GIVEN** Studio is open in two windows with the same log loaded
- **WHEN** one window shows the Auto tuning dashboard and the other shows the Drivetrain dashboard
- **THEN** their titles name their dashboards and the log, ex. "Auto tuning (match_q42) — DogLog Studio"

#### Scenario: Live source

- **GIVEN** a dashboard named Drivetrain is shown
- **WHEN** the user connects to the robot at 10.5.81.2
- **THEN** the window is titled "Drivetrain (Robot at 10.5.81.2) — DogLog Studio"

#### Scenario: Nothing to name

- **GIVEN** a window shows no dashboard or page
- **WHEN** a log named `match_q42.wpilog` is loaded
- **THEN** the window is titled "match_q42 — DogLog Studio"
- **AND** before any source is loaded, it's titled "DogLog Studio" on every platform

#### Scenario: Rename the dashboard

- **GIVEN** a window shows a dashboard
- **WHEN** the user renames it
- **THEN** the window's title uses the new name

#### Scenario: macOS desktop app

- **GIVEN** the desktop app is running on macOS
- **WHEN** a window shows the Auto tuning dashboard with `match_q42.wpilog` loaded
- **THEN** the window is titled "Auto tuning (match_q42)"

### Requirement: Pages section

The pages section SHALL show Logs, Tuning (see the tuning spec), and Settings.

Settings and the Logs sync overview SHALL use the same centered page column and side padding so their headings line up when switching pages. Settings panels SHALL have a narrower maximum width and stay aligned with the start of the heading. Each heading and its actions MUST stay visible while the content scrolls.

#### Scenario: Open Tuning

- **WHEN** the user selects Tuning in the sidebar
- **THEN** the Tuning page is shown in the main area
- **AND** Tuning is marked as the selected sidebar item

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

When a dashboard is shown, the main area SHALL show the dashboard's panes and a collapsible entry browser panel on the right.

#### Scenario: Dashboard view with an active source

- **GIVEN** a data source is active
- **WHEN** the user opens a dashboard
- **THEN** the dashboard's panes fill the main area
- **AND** the timeline bar spans the window below the panes and both sidebars

#### Scenario: Pages hide dashboard chrome

- **WHEN** the user opens the Settings page
- **THEN** the timeline bar and entry browser are not shown

### Requirement: Collapsible sidebar

Outside the phone layout, users SHALL be able to collapse the sidebar to a narrow icon-only rail and expand it again. An icon-only toggle button at the top of the sidebar MUST stay in place in both states, named by a tooltip with its keyboard shortcut. Hovering the collapsed rail MUST temporarily expand it over the dashboard without resizing the dashboard, and the collapsed state MUST persist.

#### Scenario: Collapse for more space

- **WHEN** the user collapses the sidebar
- **THEN** it shrinks to an icon-only rail
- **AND** the dashboard area grows to use the freed space as the sidebar shrinks, without passing under the app's name above the sidebar
- **AND** on macOS, where the window controls get a strip across the top of the window while the sidebar is collapsed, the dashboard area moves below the strip before the sidebar shrinks, and back up after it expands
- **AND** collapsing animates like expanding in reverse: labels fade and are clipped as the sidebar shrinks, and the layout switches to icons only after it reaches the rail width
- **AND** the toggle stays at the top, with a tooltip reading "Expand sidebar"

#### Scenario: Peek on hover

- **GIVEN** the sidebar is collapsed
- **WHEN** the user hovers the rail
- **THEN** the full sidebar slides in over the rail and the dashboard from the window's edge, as an opaque drawer
- **AND** the drawer's lower edge lines up with the dashboard panes, leaving their gap above the timeline when it is visible
- **AND** the dashboard layout does not change
- **AND** the rail stays where it is under the drawer
- **AND** the rail also peeks when the sidebar collapses under the pointer, even if the pointer stays still

#### Scenario: Stop peeking on pointer exit

- **GIVEN** the sidebar is peeking and the user has no sidebar popup open, isn't renaming a dashboard, and isn't dragging one
- **WHEN** the pointer leaves the sidebar
- **THEN** it immediately starts sliding back out past the window's edge, uncovering the rail
- **AND** the uncovered rail already shows changes made while peeking, like a newly selected page or dashboard

#### Scenario: Remember collapsed state

- **GIVEN** the user collapsed the sidebar
- **WHEN** Studio is reopened
- **THEN** the sidebar is still collapsed

#### Scenario: Toggle instantly with the keyboard

- **WHEN** the user toggles the sidebar with its keyboard shortcut
- **THEN** it collapses or expands without animating
- **AND** toggling it by clicking still animates

### Requirement: Full-screen sidebar on phones

Studio on the web SHALL use the phone layout in viewports narrower than 800 CSS pixels, or shorter than 480 CSS pixels when the primary pointer is coarse, as on a phone in landscape. In that layout, the sidebar MUST start closed regardless of the saved docked layout. Its toggle MUST stay in the top bar without reserving a rail beside the main area. Opening or closing it MUST NOT change the saved docked layout.

#### Scenario: Navigate from the sidebar on a phone

- **GIVEN** Studio is using the phone layout
- **WHEN** the user taps the sidebar toggle
- **THEN** the sidebar covers the viewport and has a button to close it
- **WHEN** the user navigates to another page or dashboard
- **THEN** the sidebar closes, revealing the selected destination

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

The macOS desktop app SHALL draw the window controls over the top of the sidebar instead of showing a title bar. The sidebar toggle MUST be shown beside the window controls, along with Back and Forward buttons, and the top of the sidebar MUST be draggable like a title bar. The expanded sidebar MUST be wide enough to show the app's name between the toggle and Back. While the sidebar is collapsed, they MUST be in a strip across the top of the window, since they're wider than the rail.

#### Scenario: Sidebar expanded

- **GIVEN** the user is using the desktop app on macOS
- **THEN** the window controls are shown at the top of the sidebar
- **AND** the sidebar toggle is shown after them, followed by the app's name, Back, and Forward

#### Scenario: Drag the window from a widget header

- **GIVEN** the user is viewing a dashboard in the desktop app on macOS
- **WHEN** the user drags the blank space in a widget header
- **THEN** the window moves
- **AND** the widget's move handle and action buttons retain their own interactions

#### Scenario: Sidebar collapsed

- **GIVEN** the user is using the desktop app on macOS
- **WHEN** the user collapses the sidebar
- **THEN** the window controls, the sidebar toggle, the app's name, Back, and Forward are shown in a strip across the top of the window
- **AND** the rail and the main area start below the strip, with their tops lined up
- **AND** the sidebar's items stay in place when it expands and the strip is removed

#### Scenario: Fullscreen

- **GIVEN** the user is using the desktop app on macOS
- **WHEN** the window is fullscreen
- **THEN** the space for the window controls is removed, including the strip while the sidebar is collapsed

### Requirement: Context menus

Context menus SHALL be shown as in-app menus, in the desktop app and on the web, so they match the rest of the app.

#### Scenario: Context menu

- **WHEN** the user right-clicks a dashboard in the sidebar
- **THEN** an in-app menu is shown

#### Scenario: Dashboard options menu

- **WHEN** the user clicks a dashboard's options button in the sidebar
- **THEN** the same menu is shown beside the button

### Requirement: Menu items are text only

Items in context menus and dropdown menus SHALL NOT show icons, so they stay easy to scan.

#### Scenario: Open a dropdown menu

- **WHEN** the user opens the dashboard options menu in the sidebar
- **THEN** each item shows only its label and keyboard shortcut, if any

#### Scenario: Open a context menu

- **WHEN** the user right-clicks a dashboard pane
- **THEN** each item shows only its label and keyboard shortcut, if any
