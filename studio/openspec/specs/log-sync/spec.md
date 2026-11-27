# log-sync Specification

## Purpose

Define how the desktop app copies logs from a roboRIO or Systemcore to the user's computer in the background, so logs from every match are on hand without plugging in a USB drive, and uploads them to the team's storage (see the log-storage spec). Logs are copied over the robot's network connection while Studio is open, and sync never slows the robot down while it's enabled or deletes anything on the robot. Studio's copy calls this downloading, since logs only go from the robot to the computer.

## Requirements

### Requirement: Desktop only

Copying logs from the robot SHALL only be available in the desktop app. The web app's Logs page MUST explain that log sync needs the desktop app in place of the robot's status (see Logs page header), except on phones and tablets, which can't run it, and offer a download of the desktop app for the user's platform, with downloads for every platform in a menu in case the detected platform is wrong. On macOS, the download MUST be the Apple silicon build, with the Intel build in the menu.

#### Scenario: Logs page in the browser

- **WHEN** the user opens the Logs page in the web app
- **THEN** the page says robot downloads need the desktop app
- **AND** no sync settings are shown

#### Scenario: Logs page in the browser with team storage

- **GIVEN** the user's team has storage the web app can reach
- **WHEN** the user opens the Logs page in the web app
- **THEN** the page says robot downloads need the desktop app, above the team's runs

#### Scenario: Logs page on a phone with team storage

- **GIVEN** the user's team has storage the web app can reach
- **WHEN** the user opens the Logs page on a phone
- **THEN** the page shows the upload row and the team's runs, without mentioning robot downloads

#### Scenario: Download the desktop app

- **GIVEN** the user opens the Logs page in the web app on Windows
- **WHEN** the user clicks Download for Windows
- **THEN** the Windows installer for the latest release downloads
- **AND** the menu next to the button lists downloads for macOS, Windows, and Linux

### Requirement: Turning sync on

Sync SHALL be off until the user starts it from the Logs page. While it's on, Studio MUST check the robot for new logs automatically for as long as Studio is open, and the Logs page MUST offer a button to check right away. The user MUST be able to pause and resume copying from the robot with its Pause button on the Logs page, and pausing MUST stop a copy in progress right away.

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
- **WHEN** the user clicks Pause next to the robot's status
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

Sync SHALL only copy logs with WPILib's, AdvantageKit's, or Phoenix 6's file names, including `.wpilogxz` and HOOT logs, and MUST skip logs that haven't been named with a date yet, since they're renamed once the Driver Station connects. The Logs page MUST let the user limit sync to logs from the last number of days, which defaults to 14, and to logs from matches run by the field (practice, qualification, and elimination matches). Changing these MUST NOT delete logs that were already synced.

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

Sync SHALL copy one log at a time, newest first, including every file of a log WPILib split into several for being too big. A log the robot is still writing MUST be copied as far as it's been written, with only the new part copied the next time sync runs. Logs that are already in the sync folder MUST NOT be copied again.

#### Scenario: Robot code still running

- **GIVEN** robot code is running and writing a log
- **WHEN** sync runs, and runs again a minute later
- **THEN** the second sync only copies what was written in that minute

#### Scenario: Log split into several files

- **GIVEN** a long match's log was split into `WPILIB_20270315_143000_CAPH_Q12.wpilog` and `WPILIB_20270315_143000_CAPH_Q12.2.wpilog`
- **WHEN** sync runs
- **THEN** both files are copied into the CAPH Q12 run

#### Scenario: Progress

- **WHEN** sync is copying logs
- **THEN** the robot's status shows which log is being copied, the progress through every log being copied, and an estimate of how long is left

### Requirement: Logs page header

The Logs page SHALL lead with two rows above the runs timeline (see the log-storage spec): the robot's row for copying from the robot, and while the team has storage, the upload row for uploading to it. Each row MUST show what it's doing, its progress, and a Pause or Resume button, without text that repeats what its icon and title say. Download settings MUST be in a panel opened from the Logs page.

#### Scenario: Offline at an event

- **GIVEN** the team's storage is in the cloud and the computer has no internet
- **WHEN** sync copies a match log from the robot
- **THEN** the robot's row shows the download, and the upload row says it can't reach the storage, with the log waiting

### Requirement: Squares for logs on the robot

The robot's row SHALL show every run with logs from the last number of days in the filter as one square, grouped by the day the run started, including the parts of a split log and its HOOT logs. Each square MUST show whether its run is synced, being copied, waiting on the robot, or doesn't fit under the storage limit, and selecting a synced run's square MUST open its logs.

#### Scenario: Day of matches

- **GIVEN** the robot has a WPILib log and a HOOT log from each of 12 qualification matches on Saturday, and 3 matches have been copied
- **WHEN** the user opens the Logs page
- **THEN** Saturday shows 12 squares, 3 of them filled in as synced

### Requirement: Pause while enabled

Sync MUST NOT copy logs from the robot while the robot is enabled, and MUST stop a copy in progress as soon as the robot is enabled. It SHALL resume once the robot has been disabled for 10 seconds, so the pause between autonomous and teleop doesn't start it. A robot whose robot code isn't running counts as disabled. Uploads MUST keep going while the robot is enabled, since they don't use the robot's connection.

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

Logs SHALL be copied to `DogLog/Logs` in the user's Documents folder, and the sync settings MUST let the user choose a different folder. The sync folder MUST use the same folders as storage (see the log-storage spec's folder layout), so each run's logs are together, and the Logs page MUST show them in the runs timeline. The Logs page MUST offer a button that opens the sync folder in the computer's file manager.

#### Scenario: Open a synced log

- **GIVEN** a match log was synced
- **WHEN** the user opens its run on the Logs page
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

The Logs page SHALL let the user limit how much space synced logs take, which is off by default. With a limit, sync MUST keep the newest logs that fit, MUST NOT copy older logs that wouldn't fit, and MUST permanently delete older logs from the sync folder to stay under the limit. Sync MUST only delete files with WPILib's, AdvantageKit's, or Phoenix 6's log names, and MUST NOT delete anything on the robot.

#### Scenario: Folder is full

- **GIVEN** the storage limit is 20 GB and the sync folder has 20 GB of logs
- **WHEN** a new match log is synced
- **THEN** the oldest logs in the folder are deleted until everything fits

#### Scenario: Other files in the folder

- **GIVEN** the sync folder has a file named `notes.wpilog`
- **WHEN** sync deletes logs to stay under the limit
- **THEN** `notes.wpilog` is kept

### Requirement: Only delete uploaded logs

While the team has storage, the storage limit SHALL have an Only delete uploaded logs option, on by default, which keeps logs that aren't uploaded yet. When only those are left to delete, sync MUST stop copying from the robot and the robot's row MUST say it's waiting for logs to upload.

#### Scenario: Folder is full of logs waiting to upload

- **GIVEN** Only delete uploaded logs is on and every log in the full sync folder is waiting to upload
- **WHEN** a new match log is on the robot
- **THEN** sync doesn't delete anything, and the robot's row says it's waiting for logs to upload

### Requirement: One window syncs

When several Studio windows are open, only one SHALL sync logs and upload them. Every other window's Logs page MUST show the same status, progress, and logs as the window that syncs, and pausing, resuming, Sync now, and sync settings MUST work from any window. When the window that syncs closes, another open window MUST take over. When another copy of Studio on the computer is syncing, the Logs page MUST say so.

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

### Requirement: Upload synced logs

While the team has storage, sync SHALL upload each log once it's finished, meaning the robot started a newer log and the copy in the sync folder has caught up, and MUST NOT upload logs the robot is still writing. Logs waiting to upload MUST stay queued until storage can be reached, including after Studio restarts. Sync MUST skip a log whose file name and size are already anywhere in storage, and when two computers upload the same log with different sizes, the larger MUST be kept.

#### Scenario: Upload after a match

- **GIVEN** sync copied the log of CAPH Q18
- **WHEN** the robot starts the log for CAPH Q19
- **THEN** the log of CAPH Q18 uploads to `2027/CAPH/Q18/`

#### Scenario: Two laptops sync one robot

- **GIVEN** two members' laptops sync the same robot
- **WHEN** both copy the finished log of CAPH Q18
- **THEN** storage has one copy of it

### Requirement: Pause uploads

The user SHALL be able to pause and resume uploads from the upload row, and pausing MUST stop an upload in progress right away. Pausing uploads MUST NOT pause copying from the robot, and pausing copying from the robot MUST NOT pause uploads.

#### Scenario: Pause uploads on a hotspot

- **GIVEN** the laptop is on a phone's hotspot
- **WHEN** the user pauses uploads
- **THEN** logs keep copying from the robot, and nothing uploads until the user resumes uploads
