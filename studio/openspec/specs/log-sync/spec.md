# log-sync Specification

## Purpose

Define how the desktop app copies logs from a roboRIO or Systemcore to the user's computer in the background, so logs from every match are on hand without plugging in a USB drive. Logs are copied over the robot's network connection while Studio is open, and sync never slows the robot down while it's enabled or deletes anything on the robot.

## Requirements

### Requirement: Desktop only

Log sync SHALL only be available in the desktop app. The web app's Logs page MUST explain that log sync needs the desktop app and offer a download of the desktop app for the user's platform, with downloads for every platform in a menu in case the detected platform is wrong. On macOS, the download MUST be the Apple silicon build, with the Intel build in the menu.

#### Scenario: Logs page in the browser

- **WHEN** the user opens the Logs page in the web app
- **THEN** the page says log sync needs the desktop app
- **AND** no sync settings are shown

#### Scenario: Download the desktop app

- **GIVEN** the user opens the Logs page in the web app on Windows
- **WHEN** the user clicks Download for Windows
- **THEN** the Windows installer for the latest release downloads
- **AND** the menu next to the button lists downloads for macOS, Windows, and Linux

### Requirement: Turning sync on

Sync SHALL be off until the user starts it from the Logs page. While it's on, Studio MUST check the robot for new logs automatically for as long as Studio is open, and the Logs page MUST offer a button to check right away. The user MUST be able to pause and resume sync from the Logs page by clicking the sync status icon, and pausing MUST stop a copy in progress right away.

#### Scenario: Sync after a match

- **GIVEN** sync is on and the robot setting is team 581
- **WHEN** a match ends and the robot is reachable from the computer
- **THEN** the log from the match is copied to the sync folder without the user doing anything

#### Scenario: Sync now

- **GIVEN** sync is on and up to date
- **WHEN** the user clicks Sync now
- **THEN** Studio checks the robot for new logs right away

#### Scenario: Pause

- **GIVEN** sync is copying a log
- **WHEN** the user clicks the sync status icon
- **THEN** the copy stops and nothing else is copied until the user clicks it again
- **AND** the rest of the log is copied after resuming

#### Scenario: No robot set

- **GIVEN** the robot connection setting is empty
- **WHEN** the user turns sync on
- **THEN** the Logs page asks the user to set their team number, with a link to Settings

### Requirement: Robot connection

Sync SHALL use the robot connection setting shared with Connect, and log in to a roboRIO or a Systemcore the same way WPILib's tools do, without asking for credentials or which kind of robot it is. It MUST read logs from both the robot's USB drive and its internal storage.

#### Scenario: Systemcore

- **GIVEN** sync is on and the robot setting is team 581
- **WHEN** team 581's robot is a Systemcore with logs on its USB drive and internal storage
- **THEN** logs from both are copied, the same as from a roboRIO

#### Scenario: Robot not reachable

- **GIVEN** sync is on
- **WHEN** the robot is off or not on the computer's network
- **THEN** the Logs page shows that sync is waiting for the robot
- **AND** sync keeps trying until the robot is reachable

### Requirement: Which logs sync

Sync SHALL only copy logs with WPILib's or AdvantageKit's file names, including AdvantageKit's compressed `.wpilogxz` logs, and MUST skip logs that haven't been named with a date yet, since they're renamed once the Driver Station connects. The Logs page MUST let the user limit sync to logs from the last number of days, which defaults to 14, and to logs from matches run by the field (practice, qualification, and elimination matches). Changing these MUST NOT delete logs that were already synced.

#### Scenario: Old logs on a USB drive

- **GIVEN** the robot's USB drive has logs from last season
- **WHEN** sync runs with the default settings
- **THEN** only logs from the last 14 days are copied

#### Scenario: Only official matches

- **GIVEN** only official matches is on
- **WHEN** the robot has logs from a qualification match and from practice in the pits
- **THEN** only the qualification match log is copied

#### Scenario: Log without a date

- **GIVEN** the robot has a log named `FRC_TBD_3f2a9c0d1e4b5a6c.wpilog`
- **WHEN** sync runs
- **THEN** that log isn't copied

### Requirement: Copying logs

Sync SHALL copy one log at a time, newest first. A log the robot is still writing MUST be copied as far as it's been written, with only the new part copied the next time sync runs. Logs that are already in the sync folder MUST NOT be copied again.

#### Scenario: Robot code still running

- **GIVEN** robot code is running and writing a log
- **WHEN** sync runs, and runs again a minute later
- **THEN** the second sync only copies what was written in that minute

#### Scenario: Progress

- **WHEN** sync is copying logs
- **THEN** the Logs page shows which log is being copied, the progress through every log being copied, and an estimate of how long is left

### Requirement: Sync overview

The Logs page SHALL lead with what sync is doing, followed by every log from the last number of days in the filter as a square, grouped by the day the log started. Each square MUST show whether its log is synced, being copied, waiting on the robot, or doesn't fit under the storage limit, and selecting a synced log's square MUST open it. Sync settings MUST be out of the way, in a panel opened from the Logs page.

#### Scenario: Day of matches

- **GIVEN** the robot has logs from 12 qualification matches on Saturday and 3 have been copied
- **WHEN** the user opens the Logs page
- **THEN** Saturday shows 12 squares, 3 of them filled in as synced

### Requirement: Pause while enabled

Sync MUST NOT copy logs while the robot is enabled, and MUST stop a copy in progress as soon as the robot is enabled. It SHALL resume once the robot has been disabled for 10 seconds, so the pause between autonomous and teleop doesn't start it. A robot whose robot code isn't running counts as disabled.

#### Scenario: Robot enabled during a copy

- **GIVEN** sync is copying a log
- **WHEN** the robot is enabled
- **THEN** the copy stops right away and the Logs page shows that sync is paused
- **AND** the rest of the log is copied once the robot has been disabled for 10 seconds

#### Scenario: Between auto and teleop

- **GIVEN** the robot was just disabled at the end of autonomous
- **WHEN** it's enabled again for teleop 3 seconds later
- **THEN** sync didn't start in between

### Requirement: Sync folder

Logs SHALL be copied to `DogLog/Logs` in the user's Documents folder, and the sync settings MUST let the user choose a different folder. The Logs page MUST list the newest few synced logs, named by their match when they're from one, and selecting one MUST open it. The Logs page MUST offer a button that opens the sync folder in the computer's file manager.

#### Scenario: Open a synced log

- **GIVEN** a match log was synced
- **WHEN** the user selects it on the Logs page
- **THEN** Studio opens that log

#### Scenario: Deleted local log

- **GIVEN** the user deleted a synced log from the sync folder
- **WHEN** the log is still on the robot and passes the sync filters
- **THEN** sync copies it again

### Requirement: No folder access before sync starts

Studio MUST NOT access the sync folder until the user starts sync for the first time, so it doesn't ask for access to the Documents folder before sync needs it.

#### Scenario: Sync never started

- **GIVEN** the user never started sync
- **WHEN** they open Studio or the Logs page
- **THEN** the computer doesn't ask them to give Studio access to the Documents folder

### Requirement: Storage limit

The Logs page SHALL let the user limit how much space synced logs take, which is off by default. With a limit, sync MUST keep the newest logs that fit, MUST NOT copy older logs that wouldn't fit, and MUST permanently delete older logs from the sync folder to stay under the limit. Sync MUST only delete files with WPILib's or AdvantageKit's log names, and MUST NOT delete anything on the robot.

#### Scenario: Folder is full

- **GIVEN** the storage limit is 20 GB and the sync folder has 20 GB of logs
- **WHEN** a new match log is synced
- **THEN** the oldest logs in the folder are deleted until everything fits

#### Scenario: Other files in the folder

- **GIVEN** the sync folder has a file named `notes.wpilog`
- **WHEN** sync deletes logs to stay under the limit
- **THEN** `notes.wpilog` is kept

### Requirement: One window syncs

When several Studio windows are open, only one SHALL sync logs. Every other window's Logs page MUST show the same status, progress, and logs as the window that syncs, and pausing, resuming, Sync now, and sync settings MUST work from any window. When the window that syncs closes, another open window MUST take over. When another copy of Studio on the computer is syncing, the Logs page MUST say so.

#### Scenario: Two windows

- **GIVEN** sync is on and Studio is open in two windows
- **WHEN** a new log is on the robot
- **THEN** it's copied once
- **AND** both windows show the progress of the copy

#### Scenario: Pause from another window

- **GIVEN** sync is copying a log in one window
- **WHEN** the user pauses sync from the Logs page in another window
- **THEN** the copy stops and both windows show that sync is paused

#### Scenario: Window that syncs closes

- **GIVEN** sync is on and Studio is open in two windows
- **WHEN** the user closes the window that syncs
- **THEN** the other window keeps syncing
