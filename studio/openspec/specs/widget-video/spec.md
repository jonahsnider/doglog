# widget-video Specification

## Purpose

Define the video widget, which plays a video of a match along with its log or live session, such as the broadcast or a recording from the stands, so teams reviewing a match see what the robot did next to what it logged.

## Requirements

### Requirement: No entries

The video widget SHALL NOT accept any entries, and MUST NOT offer Edit entries or show the "no entries" or "no data" states.

#### Scenario: Drop an entry

- **WHEN** the user drags an entry from the entry browser onto a video widget
- **THEN** the entry is not bound

### Requirement: Add a video

A video widget without a video SHALL offer to paste a YouTube link or choose a video file, shown as one or the other, and MUST accept a video file dropped on it. Adding a video MUST start Sync mode. Links to anything other than a YouTube video MUST NOT be added.

#### Scenario: Paste a YouTube link

- **GIVEN** a video widget without a video
- **WHEN** the user pastes `https://youtu.be/dQw4w9WgXcQ` into its link field
- **THEN** the widget plays that video in Sync mode

#### Scenario: Drop a file

- **GIVEN** a video widget without a video
- **WHEN** the user drops `qual12.mp4` on it
- **THEN** the widget plays `qual12.mp4` in Sync mode
- **AND** the window doesn't try to open it as a log

#### Scenario: Replace a local video by dropping another file

- **GIVEN** a video widget playing `qual12.mp4`
- **WHEN** the user drags `qual12-side.mp4` over the player
- **THEN** only the widget shows that dropping it will replace the video
- **AND** dropping it plays `qual12-side.mp4` in Sync mode without changing the open log

### Requirement: One video per widget

Each video widget SHALL have one video and one sync, saved with the dashboard, which MUST be kept when another log is opened. Replacing the video MUST discard the old one. Several videos, such as more angles of a match, are shown with several video widgets.

#### Scenario: Open another log

- **GIVEN** a video widget playing `qual12.mp4`
- **WHEN** the user opens `qual13.wpilog`
- **THEN** the widget still plays `qual12.mp4` with the same sync

### Requirement: Follow the timeline

Outside Sync mode, the video SHALL show the moment lined up with the cursor, and MUST play, pause, and change speed with the timeline. The video MUST NOT have controls of its own, and clicking it MUST play or pause like the timeline. When the timeline plays faster than the video can, the video MUST keep up with the cursor as closely as it can.

#### Scenario: Seek

- **GIVEN** a video synced so 0:00.00 in the log shows 0:10.00 in the video
- **WHEN** the user scrubs the timeline to 0:30.00 while paused, even if they reverse direction mid-scrub
- **THEN** the video shows 0:40.00 without starting playback

#### Scenario: Play a log with one local video

- **GIVEN** the dashboard is showing one synced local video during regular log playback at a speed the video supports
- **WHEN** the video starts or waits for another frame
- **THEN** the timeline holds until the video presents the next frame, without pausing the video or seeking to make it catch up
- **AND** the timeline advances on its own again outside the video's time range or when a second video is shown

#### Scenario: Play faster than YouTube can

- **GIVEN** a YouTube video, which plays at most twice as fast
- **WHEN** the timeline plays at 8x
- **THEN** the video jumps to the cursor a few times a second

### Requirement: Outside the video

When the cursor is before the video starts or after it ends, the widget SHALL show the video's first or last frame dimmed, with how long until it starts or that it ended.

#### Scenario: Before the video

- **GIVEN** a video that starts 12 seconds after the cursor
- **THEN** the widget shows the first frame dimmed with "Starts in 0:12"

### Requirement: Sync mode

Sync mode SHALL let the user line the video up with the source: the video stops following the timeline and gets its own play button, frame steps, and scrubber under it, while the timeline keeps moving the cursor. Save MUST lock the video's current moment to the cursor, and Cancel MUST leave the sync as it was. Widget options MUST offer to start Sync mode. Sync mode MUST start where the video was lined up with the cursor, or for a newly added video, at the start or at a YouTube link's timestamp.

#### Scenario: Line up the start of auto

- **GIVEN** a video widget in Sync mode
- **WHEN** the user moves the cursor to the start of auto, scrubs the video to when the field starts auto, and presses Save
- **THEN** the video and the log show auto starting together

#### Scenario: Link with a timestamp

- **WHEN** the user adds `https://youtu.be/dQw4w9WgXcQ?t=296`
- **THEN** Sync mode starts the video at 4:56

### Requirement: Fine-tune the sync

Widget options SHALL show the sync as a time on the timeline and the time in the video shown with it, both editable, with buttons to show the video one frame or 0.1 seconds earlier or later.

#### Scenario: Type the sync

- **WHEN** the user types `1:23` for the timeline and `4:56` for the video
- **THEN** 4:56 in the video is shown when the cursor is at 1:23.00

### Requirement: Sound

Videos SHALL start muted, and widget options MUST offer to play their sound. The choice MUST be kept on the device for each widget, and MUST NOT be saved with the dashboard.

#### Scenario: Play sound

- **GIVEN** a muted video widget
- **WHEN** the user turns on Play sound in its options
- **THEN** the video plays its sound, also after Studio reopens

### Requirement: Local video files

The dashboard SHALL only save a video file's name. When the device can't open the file, such as after it was moved, in browsers that can't keep file access, or on a dashboard from someone else, the widget MUST offer to choose it again and keep the sync.

#### Scenario: Shared dashboard

- **GIVEN** a teammate shares a dashboard with a video widget playing `qual12.mp4`
- **WHEN** the user opens it
- **THEN** the widget offers to choose `qual12.mp4`
- **AND** after choosing it, it plays with the teammate's sync

### Requirement: Keep access to video files

Each device SHALL keep how to open each widget's video file: its path in the desktop app, and its file handle in browsers that can keep file access. When the browser needs permission to read it again, the widget MUST ask with "Allow access". Files dropped in the desktop app MUST be kept like chosen ones.

#### Scenario: Reopen the desktop app after dropping a video

- **GIVEN** the user dropped `qual12.mp4` on a video widget in the desktop app
- **WHEN** the user reopens Studio
- **THEN** the widget plays `qual12.mp4` without choosing it again

#### Scenario: Reopen Studio in Chrome

- **GIVEN** a video widget playing `qual12.mp4` in Chrome
- **WHEN** the user reopens Studio
- **THEN** the widget offers "Allow access to qual12.mp4", and plays it once allowed

### Requirement: Shared YouTube videos

YouTube links and syncs SHALL be shared with the dashboard, in dashboard links and shared dashboards, and play the same for everyone.

#### Scenario: Dashboard link

- **GIVEN** a video widget playing a YouTube video
- **WHEN** someone opens the dashboard's link and the same log
- **THEN** they see the same video lined up the same way

### Requirement: Videos that can't play

When a video can't play, the widget SHALL say why and what to do next, and MUST keep the video and sync: YouTube videos that are private, removed, or can't be embedded MUST offer to open them on YouTube, YouTube videos while offline MUST ask to connect to the internet, and files in a format the browser can't play MUST say so.

#### Scenario: Offline

- **GIVEN** a video widget playing a YouTube video
- **WHEN** the computer goes offline
- **THEN** the widget asks to connect to the internet to play YouTube videos

### Requirement: Live sources

The widget SHALL support adding and syncing a video with a live session, including retained data after disconnecting. The sync uses seconds from the start of the shown source. Sync mode MUST NOT lock the sync until the timeline has a cursor. With no source selected, the widget SHALL prompt the user to choose one and MUST keep its video and sync.

#### Scenario: Review a disconnected session

- **GIVEN** the user has disconnected from the robot without clearing the session
- **WHEN** the user adds a video and syncs it with the retained timeline
- **THEN** the video follows that timeline without exporting and reopening a log

### Requirement: YouTube in the desktop app

The desktop app SHALL play YouTube videos like the web app, even though its pages aren't served from a website, which YouTube needs to play embedded videos.

#### Scenario: Desktop

- **WHEN** the user adds a YouTube link in the desktop app
- **THEN** the video plays

### Requirement: Match a field view to a video frame

For a local video, the context menu SHALL offer a "Match field view to this frame" submenu with "Use full frame" and "Crop frame…" when a field widget is on the dashboard. Either option SHALL let the user choose a field widget if there are several. The match MUST use at least two known 2026 AprilTags to estimate the camera pose and field of view on the device. It MUST use only the displayed frame and leave the field unchanged if the estimate fails.

#### Scenario: Match a frame

- **GIVEN** a local video showing a frame with clear AprilTags on different field surfaces
- **WHEN** the user chooses "Use full frame"
- **THEN** the chosen field widget shows the estimated camera's view in 3D

#### Scenario: Match one view in a split-screen video

- **GIVEN** a local frame showing several camera views and a field widget on its dashboard
- **WHEN** the user chooses "Crop frame…" and boxes one camera view on the frozen frame
- **THEN** Studio detects tags only within the crop and uses the crop's center and aspect ratio for the match
- **AND** the video itself remains uncropped

#### Scenario: Too few tags

- **WHEN** the user tries to match a frame that shows only one known tag
- **THEN** the field keeps its view and the video asks for a frame with at least two clear tags

#### Scenario: No reliable pose

- **WHEN** the tags in the frame do not give a reliable pose
- **THEN** the field keeps its view and the video suggests trying another frame
