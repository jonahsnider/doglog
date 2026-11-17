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

### Requirement: Desktop app

Studio SHALL be available as a desktop app for Windows, macOS, and Linux with every feature of the web app, live connections without browser restrictions, and log sync from the robot.

#### Scenario: Live connection on desktop

- **WHEN** a user on the desktop app connects to a robot by team number
- **THEN** the connection works without any permission prompt or browser restriction

### Requirement: Open logs from the OS

The desktop app SHALL register itself as an app for `.wpilog` files, so opening one from the OS opens it in Studio.

#### Scenario: Double-click a log

- **GIVEN** the desktop app is installed
- **WHEN** the user double-clicks a `.wpilog` file
- **THEN** Studio opens and shows that log

#### Scenario: Studio is already open

- **GIVEN** the desktop app is open
- **WHEN** the user opens a `.wpilog` file from the OS
- **THEN** Studio shows that log

### Requirement: Open logs from a terminal

The desktop app SHALL provide a `doglog` terminal command that opens Studio in a new window, showing the log at the path it's given. Installing the desktop app SHALL add the command to the PATH where the installer allows it, and macOS SHALL have a button in settings to install it.

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

#### Scenario: No internet at an event

- **WHEN** the user opens the desktop app with no internet connection
- **THEN** Studio opens normally without showing an update error

### Requirement: App icon

The desktop app icon, the installed web app icon, and the browser tab icon SHALL use the DogLog logo.

#### Scenario: Desktop icon

- **WHEN** the user installs the desktop app
- **THEN** its icon is the DogLog logo

#### Scenario: Installed web app

- **WHEN** the user installs the web app
- **THEN** its icon is the DogLog logo
