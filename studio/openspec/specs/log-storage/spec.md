# log-storage Specification

## Purpose

Define how a Cloud team keeps its logs and match videos in storage the team owns, such as an S3-compatible bucket or an SFTP server on a NAS, so every member can find, open, and add to the team's logs and videos from any device. The storage holds plain folders and files in a documented format, so the team's archive stays readable without Studio and other tools can add to it.

## Requirements

### Requirement: Team storage connection

Each Cloud team SHALL have at most one storage connection. Only admins MUST be able to set it up, replace its credentials, or remove it, from the Cloud page. Every member MUST be able to use it, and Studio MUST NOT show its credentials to anyone, admins included, once it's saved. Storage needs a Cloud team, and Studio without one MUST keep syncing logs from the robot to the sync folder (see the log-sync spec).

#### Scenario: A member opens the Logs page

- **GIVEN** an admin connected the team's storage
- **WHEN** a member opens the Logs page
- **THEN** they see the team's runs from storage without entering anything

#### Scenario: A member looks for the credentials

- **GIVEN** the team's storage is connected
- **WHEN** any member, admin or not, opens the storage connection on the Cloud page
- **THEN** they see its kind, endpoint, bucket or host, and root folder, but not its secret key or password

### Requirement: Kinds of storage

Studio SHALL connect to S3-compatible storage and to SFTP servers, and MUST NOT offer FTP. Setup MUST offer presets for Cloudflare R2, Backblaze B2, Amazon S3, and Google Cloud Storage that fill in what the provider needs, alongside Other S3-compatible and SFTP. SFTP MUST accept a password or a private key, and MUST NOT ask to trust the server's host key. Each connection MAY name a root folder in the bucket or server, and Studio MUST keep everything it reads and writes inside it.

#### Scenario: Set up R2

- **GIVEN** an admin chooses the Cloudflare R2 preset
- **WHEN** they enter their account ID, bucket, and access key
- **THEN** Studio fills in R2's endpoint and region without the admin looking them up

#### Scenario: Share a bucket with other data

- **GIVEN** the team's bucket already holds other files under `teams/`
- **WHEN** an admin sets the root folder to `doglog`
- **THEN** Studio only lists and writes files under `doglog/`

### Requirement: Set up storage

Setup SHALL happen in a dialog with three steps: choosing the kind of storage, from cards showing each provider's logo and what it asks for, entering its details, then checking and saving it. Replacing credentials MUST start at the details with the kind already chosen. The web app MUST still list SFTP, and choosing it MUST explain that it needs the desktop app, with a download of it, instead of asking for details.

#### Scenario: Find the key for Google Cloud Storage

- **GIVEN** an admin chooses Google Cloud Storage
- **WHEN** they reach the details
- **THEN** the key fields use Google's names, access ID and secret, show an example of each, and say to create an HMAC key for a service account under Interoperability in Cloud Storage's settings

#### Scenario: Leave setup to find a key

- **GIVEN** an admin entered some of the details and closed the dialog to create a key
- **WHEN** they open setup again before Studio reloads
- **THEN** it continues where they left off
- **AND** Studio never writes the unfinished details to disk

#### Scenario: Choose SFTP in the web app

- **GIVEN** an admin sets up storage in the web app
- **WHEN** they choose SFTP
- **THEN** Studio says SFTP needs the desktop app and offers to download it

### Requirement: Storage the web app can't reach

S3-compatible storage at an HTTPS address SHALL work in the web and desktop apps. SFTP, and S3-compatible storage at a local network or `http://` address, SHALL work only in the desktop app, since browsers can't open SSH connections or reach local addresses from a website. For those, the web app's Logs page MUST say the team's storage needs the desktop app, with a download of it (see the log-sync spec's desktop only).

#### Scenario: NAS in the pits

- **GIVEN** the team's storage is an SFTP server on a NAS in the pits
- **WHEN** a member opens the Logs page in the web app
- **THEN** the page says the team's storage needs the desktop app and offers to download it

### Requirement: Check a connection

Saving a connection SHALL check that Studio can list, write, read, and delete a test file in the root folder, showing each step as it runs, and MUST name the step that failed and what usually causes it, ex. a key without write access. For S3-compatible storage, the desktop app MUST set the bucket's CORS rules so the web app can reach it, and when it can't, MUST still save the connection and say the web app may not reach the storage and how to add the rule. When the check fails because of CORS the web app MUST say how to add the rule, in the provider's own format and only with config that provider takes.

#### Scenario: Key can't write

- **GIVEN** an admin enters a read-only access key
- **WHEN** they save the connection
- **THEN** Studio says it could list and read the bucket but not write to it, and doesn't save the connection

#### Scenario: Set up from the web app

- **GIVEN** an admin sets up a new R2 bucket in the web app
- **WHEN** the check can't reach the bucket because of CORS
- **THEN** Studio shows the CORS rule to paste into R2's settings, and checks again when asked

#### Scenario: Provider takes a different format

- **GIVEN** an admin sets up a Google Cloud Storage bucket in the web app
- **WHEN** the check can't reach the bucket because of CORS
- **THEN** Studio shows the rule in Google Cloud's own format with the command that adds it, not the format other providers' consoles take

#### Scenario: Key can't change the bucket's settings

- **GIVEN** an admin sets up a Google Cloud Storage bucket in the desktop app with a key that can read and write files but not change the bucket's settings
- **WHEN** the check passes but setting the CORS rules is denied
- **THEN** Studio says the connection was partially saved, that the storage won't work outside the desktop app until its CORS rules are updated, and shows one command that updates them

#### Scenario: No rule to paste

- **GIVEN** an admin sets up storage whose console can't take the rule Studio would show, ex. Backblaze B2 or another S3-compatible server
- **WHEN** the check can't reach the bucket because of CORS
- **THEN** Studio says what the rule must allow and that checking once from the desktop app adds it, without showing config to paste

### Requirement: Credentials stay with the team

The admin's Studio SHALL encrypt the connection's credentials with the team key, so Cloud can't read them, and every member's Studio MUST keep them on the device so storage works without reaching Cloud. When the team key rotates, Studio MUST encrypt the credentials with the new key. Signing out or leaving the team MUST delete the credentials and the cached storage listing from the device, but not logs in the sync folder.

#### Scenario: Upload at an event without internet to Cloud

- **GIVEN** a member opened the Logs page once while online
- **WHEN** Studio can reach the team's NAS but not Cloud
- **THEN** logs still upload to the NAS

#### Scenario: Leave the team

- **GIVEN** a member has synced and uploaded logs on their laptop
- **WHEN** they leave the team
- **THEN** Studio no longer shows or reaches the team's storage
- **AND** the logs in their sync folder stay

### Requirement: Removed members keep credentials

Removing a member SHALL NOT revoke their access to the team's storage, since their Studio, or a copy of it, may still have the credentials. The Cloud page MUST say so when an admin removes a member while storage is connected, and MUST offer Replace credentials, which saves new credentials for the same storage after checking them.

#### Scenario: Remove a member

- **GIVEN** the team's storage is connected
- **WHEN** an admin removes a member
- **THEN** Studio warns that the member may still be able to reach the team's storage until its credentials are replaced
- **AND** offers Replace credentials

### Requirement: Every member can change storage

Every member SHALL be able to upload, rename, move, and delete anything in the team's storage, the same as admins. Deleting MUST ask to confirm first, naming what will be deleted and that it can't be undone unless the storage keeps old versions.

#### Scenario: Delete a run

- **GIVEN** a member selects the `2027/CAPH/Q12` folder
- **WHEN** they choose Delete
- **THEN** Studio asks to confirm deleting the folder and its 5 files before deleting anything

### Requirement: Runs

A run SHALL be one robot log, with its parts if WPILib split it into several files, every HOOT log whose recording overlaps it, and every video linked to it. A log that covers many enables, such as a practice session, MUST stay one run. A video that isn't linked to a log yet MUST be a run of its own. Runs MUST NOT contain other runs.

#### Scenario: Qualification match

- **GIVEN** the robot logged `WPILIB_20270313_231204_CAPH_Q18.wpilog` and `CAPH_Q18_rio_2027-03-13_23-12-04.hoot`
- **AND** a member uploaded `stands.mp4` and linked a YouTube video of the broadcast to the match
- **THEN** CAPH Q18 is one run with two logs and two videos

### Requirement: Folder layout

Storage SHALL keep each run in its own folder, inside the root folder:

- `<season>/<event>/<match>/` for a log from a field match, ex. `2027/CAPH/Q18/`
- `<season>/<date>/<time>/` for other logs, ex. `2027/2027-03-13/14-02-04/`
- `<season>/<date>/Unsorted/` for videos that aren't linked to a log yet

The season is the year the log started. Dates and times MUST be in the time zone of the computer that uploads the log. Files MUST keep the names the robot or the user gave them.

#### Scenario: Practice in the evening

- **GIVEN** a laptop in California syncs a log started at 6:15 PM on March 9
- **WHEN** it uploads the log
- **THEN** the log goes in `2027/2027-03-09/18-15-00/`, even though its file name says March 10 in UTC

### Requirement: Run file

Each run folder with a log SHALL have a `doglog.json` file describing the run, written by whoever uploads its log, with `version`, the run's `start` time with its UTC offset, `duration` in seconds, `event` and `match` for field matches, `team`, whether it has `auto` and `teleop`, and its `logs` by file name. Studio MUST work out these values when it uploads the log, so it never needs to read a log to list the run.

#### Scenario: Run file for a match

- **WHEN** Studio uploads the log of CAPH Q18
- **THEN** `2027/CAPH/Q18/doglog.json` is `{ "version": 1, "start": "2027-03-13T16:12:04-07:00", "duration": 154.2, "event": "CAPH", "match": "Q18", "team": 581, "auto": true, "teleop": true, "logs": ["WPILIB_20270313_231204_CAPH_Q18.wpilog", "CAPH_Q18_rio_2027-03-13_23-12-04.hoot"] }`

### Requirement: Video files

Each video in a run SHALL have a `<video>.doglog.json` file next to it, with `version`, an `angle` name such as "Stands" or "Broadcast", and its sync `offset` in seconds, where a moment in the video is the moment in the run's log plus the offset. Uploading a video file MUST also save a frame from it as `<video>.jpg` for its run's row. A YouTube video SHALL be a `<angle>.doglog.json` file with its `youtube` link and no video file, using YouTube's thumbnail for its run's row.

#### Scenario: Video file

- **WHEN** a member uploads `stands.mp4` to CAPH Q18 and syncs it
- **THEN** the run folder has `stands.mp4`, `stands.mp4.jpg`, and `stands.mp4.doglog.json` with `{ "version": 1, "angle": "Stands", "offset": -3.42 }`

#### Scenario: Broadcast

- **WHEN** a member adds a YouTube link to CAPH Q18 as Broadcast
- **THEN** the run folder has `Broadcast.doglog.json` with `{ "version": 1, "angle": "Broadcast", "youtube": "https://www.youtube.com/watch?v=…", "offset": 12.5 }`

### Requirement: Storage is the source of truth

The folders and files in storage SHALL be the only record of the team's runs. Studio MUST show runs that other tools or people added, reading what it needs from `doglog.json` files or, without one, from the log's file name. When Studio rewrites a `doglog.json` file, it MUST keep fields it doesn't know.

#### Scenario: Files added by another tool

- **GIVEN** another tool added `2027/CAPH/Q21/` with a log, a video, and their `doglog.json` files
- **WHEN** a member opens the Logs page
- **THEN** CAPH Q21 is in the timeline with its video

#### Scenario: Fields from another tool

- **GIVEN** a video's `doglog.json` file has a `confidence` field Studio doesn't use
- **WHEN** a member changes the video's sync in Studio
- **THEN** the file keeps its `confidence` field

### Requirement: Finding runs

Each device SHALL find the team's runs by listing the storage, and MUST keep what it read on the device, reading a `doglog.json` file again only when the listing shows it changed. Studio MUST list the storage again when the Logs page opens, when its window is focused, every minute while the page is shown, and after it uploads something. Without a connection, the Logs page MUST show the runs it listed last, and say when.

#### Scenario: A teammate uploads a match

- **GIVEN** two members have the Logs page open
- **WHEN** one of them uploads CAPH Q19
- **THEN** CAPH Q19 shows up on the other's page within a minute

### Requirement: Runs timeline

The Logs page SHALL show every run from the sync folder and from storage in one timeline, newest first, grouped by day with each day's events. Each run MUST be one row showing a frame from its first video when it has one, its match or start time, its duration, and how many WPILOGs, HOOT logs, and videos it has. A run that's only on this computer MUST show that it isn't uploaded yet, and a run that's uploading MUST show its progress. Runs that are already in storage MUST NOT show a status.

#### Scenario: Offline at an event

- **GIVEN** the laptop synced CAPH Q14, Q17, and Q18 without internet
- **WHEN** the user opens the Logs page
- **THEN** those runs show as not uploaded, next to the runs listed from storage before going offline

#### Scenario: A video without a date

- **GIVEN** a member uploaded `phone.mov` to a folder without a date in its path
- **WHEN** the user opens the Logs page
- **THEN** it shows first, under a heading saying it has no date, instead of at the end of the timeline

### Requirement: Search and filter runs

The timeline SHALL have a search field matching event, match, date, and file names, and filters for event, kind of run (qualification, elimination, practice match, or other), and runs with video.

#### Scenario: Find a match

- **WHEN** the user types `q18` in the search field
- **THEN** the timeline only shows CAPH Q18 and other runs matching it

### Requirement: Open a run

Opening a run SHALL add its logs to the window as sources, like opening them one by one (see the data-sources spec). A run only in storage MUST open straight from storage without saving it to the sync folder, and its logs MUST NOT be added to recent logs.

#### Scenario: Compare two matches

- **GIVEN** CAPH Q17 is open
- **WHEN** the user opens CAPH Q18 from the timeline
- **THEN** both runs' logs are open, lined up with each other

### Requirement: Files

The Logs page SHALL have a Files view of the folders and files in the team's storage, where members can browse, upload files to any folder, create folders, rename, move, and delete (see Every member can change storage). It MUST only be offered while the team's storage is connected.

#### Scenario: Move a misplaced log

- **GIVEN** a log was uploaded to the wrong run
- **WHEN** a member drags it to the right run's folder in Files
- **THEN** the log moves there, and the timeline shows it in the right run

### Requirement: Upload logs and videos

Members SHALL be able to upload logs and videos by dropping them on the timeline or choosing them. Logs MUST upload without asking, to the run folder their file names call for. For a video, Studio MUST suggest the run whose log was enabled when it was recorded, from its capture time, and start its sync from that time, which the user MUST confirm or change. When no run fits clearly, the video MUST go in Unsorted. Linking a video in Unsorted to a run later MUST move it into the run's folder.

#### Scenario: Upload a stands video

- **GIVEN** a member recorded CAPH Q18 from the stands on their phone
- **WHEN** they drop the video on the timeline
- **THEN** Studio suggests CAPH Q18, and uploads it there once they confirm

#### Scenario: Video from an unknown time

- **GIVEN** a video file with no capture time
- **WHEN** a member uploads it without choosing a run
- **THEN** it goes in that day's Unsorted folder

### Requirement: Resume uploads

Uploads SHALL send big files in parts, so an upload that stops, ex. from losing the connection, continues from the last part sent instead of starting over. The desktop app MUST continue uploads after Studio restarts, and the web app MUST continue them while the page stays open.

#### Scenario: Wi-Fi drops

- **GIVEN** a 600 MB video is 70% uploaded
- **WHEN** the connection drops and comes back
- **THEN** the upload continues from about 70%
