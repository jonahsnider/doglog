# platforms Specification

## Purpose

Define how Studio is distributed: as an installable, offline-capable website, and as a desktop app for Windows, macOS, and Linux that removes browser networking limits.

## Requirements

### Requirement: Web app

Studio SHALL be available as a website that supports opening logs in modern browsers and live connections where the browser allows them.

#### Scenario: Open a log in the browser

- **WHEN** a user visits the Studio website and opens a `.wpilog` file
- **THEN** the log is viewable without installing anything

#### Scenario: Live connection in Chrome

- **GIVEN** a user on Chrome visits the Studio website
- **WHEN** they connect to a robot by IP address and grant the local network permission
- **THEN** the live connection works

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

The desktop app SHALL register itself as an app for `.wpilog` files, so opening one from the OS opens it in Studio. The installed web app SHALL do the same in browsers that support file handling, ex. Chrome and Edge.

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

### Requirement: Open recent logs

The desktop app SHALL keep a list of the 10 logs it opened most recently, newest first. The source control menu's Open recent submenu and, on macOS, File > Open Recent MUST list them, with an item that clears the list. Logs opened from a path, ex. with the file picker, from the OS, or from the Logs page, MUST be added, and logs that can't be read MUST be removed.

#### Scenario: Reopen a recent log

- **GIVEN** the user opened `match.wpilog` in the desktop app on macOS
- **WHEN** the user chooses File > Open Recent > match.wpilog
- **THEN** that log becomes the active source

#### Scenario: Reopen a recent log from the source control

- **GIVEN** the user opened `match.wpilog` in the desktop app
- **WHEN** the user chooses Open recent > match.wpilog in the source control menu
- **THEN** that log becomes the active source

#### Scenario: Recent log was deleted

- **GIVEN** `match.wpilog` is in the recent logs
- **AND** the file was deleted
- **WHEN** the user chooses it
- **THEN** Studio shows that it couldn't open the log
- **AND** it's removed from the recent logs

### Requirement: Open recent logs in the web app

The web app SHALL keep the same recent logs list in browsers that support the File System Access API, ex. Chrome and Edge, with logs opened with the file picker, by dropping them on the window, or from the OS. Reopening a recent log MUST ask for permission to read it when the browser needs it, and declining MUST keep it in the list. Other browsers don't keep access to opened files, so the web app doesn't list recent logs in them.

#### Scenario: Reopen a recent log in the web app

- **GIVEN** the user opened `match.wpilog` in the web app in Chrome, then reloaded the page
- **WHEN** the user chooses Open recent > match.wpilog in the source control menu
- **AND** allows Studio to view the file
- **THEN** that log becomes the active source

#### Scenario: Decline access to a recent log

- **GIVEN** `match.wpilog` is in the web app's recent logs
- **WHEN** the user chooses it and doesn't allow Studio to view the file
- **THEN** the active source doesn't change
- **AND** `match.wpilog` stays in the recent logs

### Requirement: Open logs from a terminal

The desktop app SHALL provide a `doglog` terminal command that opens Studio in a new window, showing the log at the path it's given. The same command also controls open windows and runs the MCP server for agents, see agent-control. Installing the desktop app SHALL add the command to the PATH where the installer allows it, and macOS SHALL have a button in settings to install it.

#### Scenario: Open a log from a terminal

- **GIVEN** the `doglog` command is installed
- **WHEN** the user runs `doglog match.wpilog`
- **THEN** a new Studio window opens and shows that log
- **AND** the terminal is free to use while Studio is open

#### Scenario: Studio is already open

- **GIVEN** a Studio window is open
- **WHEN** the user runs `doglog match.wpilog`
- **THEN** a separate window shows that log, so each window keeps its own data source

#### Scenario: Help

- **WHEN** the user runs `doglog --help` on macOS or Linux
- **THEN** the terminal shows how to use the command

#### Scenario: Install on macOS

- **GIVEN** the desktop app is installed on macOS
- **WHEN** the user clicks the button in settings to install the command and enters their password
- **THEN** `doglog` works in new terminals

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

#### Scenario: No internet at an event

- **WHEN** the user opens the desktop app with no internet connection
- **THEN** Studio opens normally without showing an update error

### Requirement: Desktop window size and position

The desktop app SHALL open its window with the size, position, and maximized state of the last closed window. Only the first open window MUST go back to the saved position, other windows MUST open centered with the saved size so they don't cover it. Fullscreen MUST NOT be restored.

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

### Requirement: App icon

The desktop app icon, the installed web app icon, and the browser tab icon SHALL use the DogLog logo.

#### Scenario: Desktop icon

- **WHEN** the user installs the desktop app
- **THEN** its icon is the DogLog logo

#### Scenario: Installed web app

- **WHEN** the user installs the web app
- **THEN** its icon is the DogLog logo

### Requirement: About panel

On macOS, the desktop app's About DogLog Studio panel SHALL show the running Studio version and, when Studio was built from a Git repository, the short hash of the commit it was built from. It SHALL also show the copyright and a short description of Studio.

#### Scenario: Built from Git

- **GIVEN** Studio version 2026.1.0 was built from commit `9867e24`
- **WHEN** the user chooses DogLog Studio > About DogLog Studio
- **THEN** the panel shows version 2026.1.0 and commit `9867e24`
