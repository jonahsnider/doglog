# platforms Specification

## Purpose

Define how Studio is distributed: as an installable, offline-capable website, and as a desktop app for Windows, macOS, and Linux that removes browser networking limits, and which browsers and OS versions it supports.

## Requirements

### Requirement: Supported browsers and operating systems

The web app SHALL support browsers that have every Baseline Widely Available feature, and MAY use newer features only when Studio still works without them. The desktop app SHALL support macOS 15 Sequoia, Windows 10, Ubuntu 22.04, and later versions of each.

#### Scenario: Older supported browser

- **GIVEN** a browser that supports Baseline Widely Available features but nothing newer
- **WHEN** the user opens a log in the web app
- **THEN** the log is viewable and Studio works the same as in the newest browsers

#### Scenario: Unsupported macOS version

- **WHEN** a user on macOS 14 tries to open the desktop app
- **THEN** macOS says the app needs a newer version of macOS

### Requirement: Web app

Studio SHALL be available as a website that supports opening logs in modern browsers and live connections where the browser allows them.

#### Scenario: Open a log in the browser

- **WHEN** a user visits the Studio website and opens a `.wpilog` file
- **THEN** the log is viewable without installing anything

#### Scenario: Live connection in Chrome

- **GIVEN** a user on Chrome visits the Studio website
- **WHEN** they connect to a robot by IP address and grant the local network permission
- **THEN** the live connection works

#### Scenario: Phone with a notch and home indicator

- **GIVEN** a user opens Studio on an iPhone with a Dynamic Island and a home indicator, in the browser or as an installed web app
- **WHEN** they open the sidebar, in portrait or landscape
- **THEN** its header, pages, dashboards, and bottom rows stay inside the screen's safe area, clear of the Dynamic Island and home indicator
- **AND** the timeline's controls stay above the home indicator, while dashboard panes reach behind it
- **AND** the app's backgrounds still reach the screen's edges

### Requirement: Offline web app

The web app SHALL be an installable PWA that works offline after the first visit, including opening logs.

#### Scenario: No internet at an event

- **GIVEN** the user visited Studio before
- **WHEN** they open it with no internet connection
- **THEN** Studio loads and can open logs

#### Scenario: New version deployed while Studio is open

- **GIVEN** the user has Studio open in a browser tab
- **WHEN** a new version of the website is deployed
- **THEN** the open tab keeps working on its current version without errors or reloads
- **AND** Studio opens on the new version once every Studio tab and window has been closed

### Requirement: Desktop app

Studio SHALL be available as a desktop app for Windows, macOS, and Linux with every feature of the web app, live connections without browser restrictions, and log sync from the robot.

#### Scenario: Live connection on desktop

- **WHEN** a user on the desktop app connects to a robot by team number
- **THEN** the connection works without any permission prompt or browser restriction

### Requirement: Open logs from the OS

The desktop app SHALL register itself as an app for `.wpilog`, `.wpilogxz`, and `.hoot` files, so opening one from the OS opens it in Studio. The installed web app SHALL do the same in browsers that support file handling, ex. Chrome and Edge.

#### Scenario: Log icons in Finder

- **GIVEN** Studio is installed on macOS
- **WHEN** Finder displays a log using Studio's file association instead of a thumbnail or another app's icon
- **THEN** macOS draws the document icon with a WPILib badge for `.wpilog` and `.wpilogxz`, or a CTRE badge for `.hoot`

#### Scenario: Double-click a log

- **GIVEN** the desktop app is installed
- **WHEN** the user double-clicks a `.wpilog` file
- **THEN** Studio opens and shows that log

#### Scenario: Studio is already open

- **GIVEN** the desktop app is open
- **WHEN** the user opens a `.wpilog` file from the OS
- **THEN** Studio shows that log

#### Scenario: Open a log with the installed web app

- **GIVEN** the user installed the web app in Chrome
- **WHEN** the user opens a `.wpilog` file with DogLog Studio from the OS
- **THEN** Studio opens and shows that log

### Requirement: Open log links in the desktop app

The desktop app SHALL register itself as the handler for `doglog://open?url=<log-url>` URLs, downloading and opening the log natively without browser CORS limits. On cold start, the link MUST open in the initial window. When Studio is already running, it MUST reuse the last-focused window if that window has neither a log nor a live session; otherwise it MUST open a new window.

#### Scenario: Open a log link with Studio already showing another log

- **GIVEN** the desktop app is open and showing `qual12.wpilog`
- **WHEN** the user opens `doglog://open?url=https://example.com/qual13.wpilog`
- **THEN** a new Studio window opens and loads `qual13.wpilog`
- **AND** the existing window keeps showing `qual12.wpilog`

#### Scenario: Open a log link when the focused window is empty

- **GIVEN** the desktop app is open and the focused window has no log and no live session
- **WHEN** the user opens `doglog://open?url=https://example.com/qual13.wpilog`
- **THEN** that window loads `qual13.wpilog` without opening another window

### Requirement: Open log links in the web app

The web app SHALL handle `/open?url=<log-url>` with desktop handoff. Desktop Chromium opens `doglog://open?url=<log-url>` while fetching, aborting if focus leaves right after and restarting if focus returns on `/open`. Desktop Safari and Firefox show an "Open in the desktop app?" toast that aborts the fetch on Open. Mobile fetches directly. Valid logs redirect replacing history; failures stay on `/open` with Open in desktop app, Download file, and Back to dashboards.

#### Scenario: Open a log link in a browser when CORS blocks the host

- **GIVEN** `https://example.com/qual13.wpilog` does not send CORS headers
- **WHEN** a user opens `https://doglog.studio/open?url=https://example.com/qual13.wpilog` in a desktop browser without opening the desktop app
- **THEN** Studio stays on `/open`, explains that the browser could not fetch the file, and offers Open in desktop app, Download file, and Back to dashboards

#### Scenario: Open a log link in desktop Safari and choose Open in the toast

- **GIVEN** a user opens `https://doglog.studio/open?url=https://example.com/qual13.wpilog` in desktop Safari
- **WHEN** they choose Open in the "Open in the desktop app?" toast while the log is downloading
- **THEN** Studio aborts the browser download and opens `doglog://open?url=https%3A%2F%2Fexample.com%2Fqual13.wpilog`

### Requirement: Open recent logs

The desktop app SHALL keep a list of the 10 logs it opened most recently, newest first. The source list's header menu's Open recent submenu and, on macOS, File > Open Recent MUST list them, with an item that clears the list. Logs opened from a path, ex. with the file picker, by dropping them on the window, from the OS, or from the Logs page, MUST be added, and logs that can't be read MUST be removed.

#### Scenario: Reopen a recent log

- **GIVEN** the user opened `match.wpilog` in the desktop app on macOS
- **WHEN** the user chooses File > Open Recent > match.wpilog
- **THEN** that log is added to the focused window

#### Scenario: Reopen a recent log from the source list

- **GIVEN** the user opened `match.wpilog` in the desktop app
- **WHEN** the user chooses Open recent > match.wpilog in the source list's header menu
- **THEN** that log is added to the window

#### Scenario: Recent log was deleted

- **GIVEN** `match.wpilog` is in the recent logs
- **AND** the file was deleted
- **WHEN** the user chooses it
- **THEN** Studio shows that it couldn't open the log
- **AND** it's removed from the recent logs

### Requirement: Recent logs in the Dock and jump list

The desktop app SHALL add the logs it opens to the OS's recent documents, which macOS lists in the Dock icon's menu and Windows in the taskbar icon's jump list. Clearing the recent logs MUST clear them there too. The OS sorts that list. Linux and the installed web app have no equivalent, since web app manifest shortcuts are fixed when it's installed.

#### Scenario: Reopen a recent log from the Dock

- **GIVEN** the user opened `match.wpilog` in the desktop app on macOS
- **WHEN** the user chooses match.wpilog in the Dock icon's menu
- **THEN** Studio shows that log

### Requirement: Open recent logs in the web app

The web app SHALL keep the same recent logs list in browsers that support the File System Access API, ex. Chrome and Edge, with logs opened with the file picker, by dropping them on the window, or from the OS. Reopening a recent log MUST ask for permission to read it when the browser needs it, and declining MUST keep it in the list. Other browsers don't keep access to opened files, so the web app doesn't list recent logs in them.

#### Scenario: Reopen a recent log in the web app

- **GIVEN** the user opened `match.wpilog` in the web app in Chrome, then reloaded the page
- **WHEN** the user chooses Open recent > match.wpilog in the source list's header menu
- **AND** allows Studio to view the file
- **THEN** that log is added to the window

#### Scenario: Decline access to a recent log

- **GIVEN** `match.wpilog` is in the web app's recent logs
- **WHEN** the user chooses it and doesn't allow Studio to view the file
- **THEN** no source is added
- **AND** `match.wpilog` stays in the recent logs

### Requirement: Open logs from a terminal

The desktop app SHALL provide a `doglog` terminal command that opens Studio in a new window, showing the log at the file path or HTTP(S) URL it's given. The same command also controls open windows and runs the MCP server for agents, see agent-control. Installing the desktop app SHALL add the command to the PATH where the installer allows it, and macOS SHALL have a button in settings to install it.

#### Scenario: Open a log from a terminal

- **GIVEN** the `doglog` command is installed
- **WHEN** the user runs `doglog match.wpilog`
- **THEN** a new Studio window opens and shows that log
- **AND** the terminal is free to use while Studio is open

#### Scenario: Open a log URL from a terminal

- **GIVEN** the `doglog` command is installed
- **WHEN** the user runs `doglog https://example.com/match.wpilog`
- **THEN** a new Studio window opens and downloads and shows that log

#### Scenario: Studio is already open

- **GIVEN** a Studio window is open
- **WHEN** the user runs `doglog match.wpilog`
- **THEN** a separate window shows that log, so the open window's sources don't change

#### Scenario: Help

- **WHEN** the user runs `doglog --help` on macOS or Linux
- **THEN** the terminal shows how to use the command

#### Scenario: Install on macOS

- **GIVEN** the desktop app is installed on macOS
- **WHEN** the user clicks the button in settings to install the command and enters their password
- **THEN** `doglog` works in new terminals

### Requirement: Move sources between windows

The desktop app SHALL let users move a source to another window, from the source's Move to submenu, which lists New window and every other open window by title, or by dragging its row onto another window's source list. A moved source MUST appear in the other window right away, with its data, without reading or downloading the log again. Moving a window's last source MUST leave the window open without sources.

#### Scenario: Move it back

- **GIVEN** the user popped `qual13.wpilog` out into a new window
- **WHEN** the user drags its row onto the first window's source list, the same as moving any source
- **THEN** `qual13.wpilog` is added to the first window where it was dropped in the list, without reading the file again
- **AND** the new window stays open without sources

### Requirement: Window for a moved source

A new window opened by moving a source SHALL show the dashboard the source's old window showed, with the cursor at the same moment of that source, paused or following live as it was.

#### Scenario: Pop out a log

- **GIVEN** a window shows the Drivetrain dashboard with `qual12.wpilog` and `qual13.wpilog`, paused at the start of auto
- **WHEN** the user chooses Move to > New window from `qual13.wpilog`'s menu
- **THEN** a new window opens showing the Drivetrain dashboard with `qual13.wpilog`, paused at the start of its auto
- **AND** the first window keeps showing `qual12.wpilog`

### Requirement: Drag a source out of a window

In the desktop app, dropping a source's row outside every Studio window SHALL open a new window at the drop point with that source, like dragging a browser tab out, the same as choosing Move to > New window.

#### Scenario: Drag a log out

- **GIVEN** a window has `qual12.wpilog` and `qual13.wpilog`
- **WHEN** the user drags `qual13.wpilog`'s row onto the desktop
- **THEN** a new window opens there with `qual13.wpilog`
- **AND** the first window keeps `qual12.wpilog`

### Requirement: Move the live session between windows

Moving the live session to another window MUST keep it connected and keep its history, disconnect gaps, and recording, which the other window now owns. A window that already has a live session MUST NOT accept another, so Move to omits it for the live session and a dropped live session snaps back.

#### Scenario: Pop out the live session

- **GIVEN** the user is connected to the robot with `reference.wpilog` open, and the cursor follows the live session
- **WHEN** the user drags the live session's row outside every Studio window
- **THEN** a new window opens where it was dropped, following the live session with all of its history
- **AND** the robot stays connected without a gap on the timeline
- **AND** the first window keeps `reference.wpilog`

#### Scenario: Window with its own live session

- **GIVEN** two windows are each connected to the robot
- **WHEN** the user opens the Move to submenu of one window's live session
- **THEN** it lists New window but not the other window

#### Scenario: Restore a moved live session

- **GIVEN** the user moved the live session to a new window, then quit Studio
- **WHEN** the user opens Studio again
- **THEN** the live session is restored like any other (see the data-sources spec's restore the live session)

### Requirement: Desktop auto-update

The desktop app SHALL update itself automatically.

#### Scenario: New version available

- **GIVEN** a newer desktop version is released
- **WHEN** the user opens the desktop app with internet access
- **THEN** the bottom of the sidebar shows a button to update to that version
- **AND** clicking it installs the update and restarts Studio, without the user downloading it manually

#### Scenario: Check for updates from the menu

- **GIVEN** the desktop app is running on macOS
- **WHEN** the user chooses DogLog Studio > Check for Updates…
- **THEN** a toast says whether a newer version is released
- **AND** if one is, the sidebar shows the button to update to it

#### Scenario: Update with the keyboard

- **GIVEN** the desktop app is running
- **WHEN** the user presses ⇧⌘U
- **THEN** a toast shows Studio checking for updates, then says whether a newer version is available
- **AND** if one is, pressing ⇧⌘U again shows a toast that Studio is updating, then installs the update and restarts Studio

#### Scenario: Update from the toast

- **GIVEN** a toast says a newer version is available
- **THEN** it has a button that installs the update, the same as pressing the update shortcut again
- **AND** hovering the button shows a tooltip with the shortcut

#### Scenario: Update progress

- **WHEN** the desktop app installs an update from the shortcut or the toast
- **THEN** the toast shows the download's percent as it counts up, in the same toast
- **AND** once the download finishes, it says the update is being prepared until Studio restarts

#### Scenario: Check for updates repeatedly

- **WHEN** the user checks for updates several times in a row, from any mix of the shortcut, menu, and sidebar
- **THEN** at most one update toast is shown, and each check replaces it in place
- **AND** installing the update, or failing to, replaces that same toast

#### Scenario: No internet at an event

- **WHEN** the user opens the desktop app with no internet connection
- **THEN** Studio opens normally without showing an update error

### Requirement: Web app updates

The web app SHALL offer to update to a newer deployed version, the same way the desktop app does. It MUST NOT switch to the new version on its own while Studio is open, and since the web app can't know the new version's number, it MUST NOT show one.

#### Scenario: New version deployed

- **GIVEN** a newer version of the web app is deployed
- **WHEN** the user opens Studio in a browser with internet access
- **THEN** once the new version finishes downloading, the bottom of the sidebar shows an Update Studio button
- **AND** clicking it reloads every open Studio tab into the new version

#### Scenario: Update with the keyboard on the web

- **WHEN** the user presses ⌥⇧U in the web app
- **THEN** a toast shows Studio checking for updates, then says whether a newer version is available
- **AND** if one is, pressing ⌥⇧U again shows a toast that Studio is updating, then reloads every open Studio tab into it

#### Scenario: Open the web app offline

- **WHEN** the user opens the web app with no internet connection
- **THEN** Studio opens normally without showing an update error

### Requirement: Desktop window size and position

The desktop app SHALL open its window with the size, position, and maximized state of the last closed window. Only the first open window MUST go back to the saved position, other windows MUST open centered with the saved size so they don't cover it. Fullscreen MUST NOT be restored. A window MUST appear already in place with its page drawn, without animating to its size or showing an empty frame first.

#### Scenario: Reopen Studio

- **GIVEN** the user moved and resized the Studio window
- **WHEN** they close Studio and open it again
- **THEN** the window has the same size and position

#### Scenario: Open a second window

- **GIVEN** a Studio window is open
- **WHEN** the user opens another window
- **THEN** the new window has the saved size and is centered on the screen

#### Scenario: Screen was disconnected

- **GIVEN** Studio was closed on an external monitor
- **WHEN** the user opens Studio without that monitor connected
- **THEN** the window opens on a connected screen

### Requirement: Desktop minimum window size

The desktop window SHALL NOT be made smaller than 720 by 480 pixels. On a dashboard, it MUST also stay big enough for every pane to be at least 200 by 120 pixels beside the sidebar, entry browser, and timeline bar at their current sizes, and it MUST grow to fit when a split or a wider entry browser needs more room.

#### Scenario: Shrink the window

- **WHEN** the user drags the window's corner to make it as small as possible on the Settings page
- **THEN** it stops at 720 by 480 pixels

#### Scenario: Shrink a window with many panes

- **GIVEN** a dashboard with four panes side by side
- **WHEN** the user makes the window as narrow as possible
- **THEN** it stops once each pane is 200 pixels wide

#### Scenario: Split a pane in a small window

- **GIVEN** a window that's as narrow as the panes allow
- **WHEN** the user splits a pane right
- **THEN** the window widens so each pane is still 200 pixels wide

### Requirement: App icon

The desktop app icon, the installed web app icon, and the browser tab icon SHALL use the DogLog logo.
On macOS 26 and later, the desktop app SHALL provide a layered app icon that follows the system's icon and widget style.

#### Scenario: Desktop icon

- **WHEN** the user installs the desktop app
- **THEN** its icon is the DogLog logo

#### Scenario: Dark macOS icon

- **GIVEN** the user has installed the desktop app on macOS 26 or later
- **WHEN** macOS uses the Dark icon and widget style
- **THEN** the desktop app uses the dark variant of the layered DogLog icon, with a light red trace and cursor that stand out against the dark background

#### Scenario: Installed web app

- **WHEN** the user installs the web app
- **THEN** its icon is the DogLog logo

### Requirement: About dialog

Studio SHALL offer an About dialog from Settings on every platform and from the app menu on macOS. The dialog SHALL show the app logo, running version, short commit hash when built from Git, copyright, a short description, and a bulleted list of contributors and what they contributed. The dialog's text SHALL be selectable for copying.

#### Scenario: Open About from the macOS app menu

- **GIVEN** Studio version 2026.1.0 was built from commit `9867e24`
- **WHEN** the user chooses DogLog Studio > About DogLog Studio
- **THEN** the dialog opens over the current page and shows version 2026.1.0 and commit `9867e24`

#### Scenario: Open About from Settings

- **WHEN** the user selects About DogLog Studio in Settings
- **THEN** the dialog opens with a bulleted list of acknowledgments
