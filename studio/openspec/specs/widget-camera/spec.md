# widget-camera Specification

## Purpose

Show live robot camera feeds in dashboard panes so teams can see what their cameras see alongside live robot data.

## Requirements

### Requirement: Discover cameras on the live connection

Studio SHALL discover named cameras from CameraServer's `/CameraPublisher/<name>/streams` advertisements on the selected live NetworkTables connection. A camera MUST be listed once by name if it advertises at least one `mjpg:` stream over HTTP or HTTPS. Studio MUST connect directly to the advertised stream address, which may be on a different host than the NetworkTables server. The widget MUST NOT offer manual URLs or discover cameras from recorded entries.

#### Scenario: Camera on a coprocessor

- **GIVEN** the robot advertises `Intake` with an MJPEG stream on a coprocessor
- **WHEN** the user selects `Intake` in a Camera widget and follows live data
- **THEN** the widget shows the coprocessor's feed

### Requirement: Select one camera per widget

The widget picker SHALL offer a Camera widget with at most one feed, no entry bindings, and no Edit entries button. An unassigned pane SHALL list advertised cameras by name, or say none are advertised if connected. Widget options MUST let the user pick any advertised camera, even one used by another pane. The pane MUST name the selected camera and show the full frame without stretching or cropping. It MUST NOT offer playback controls or change the camera's hardware settings.

#### Scenario: Switch camera feeds

- **GIVEN** a Camera widget showing `Front`
- **WHEN** the user selects `Rear` in widget options
- **THEN** the pane stops showing `Front` and shows `Rear` as soon as frames arrive

### Requirement: Rotate the camera view

Camera widget options SHALL offer clockwise rotation of 0°, 90°, 180°, and 270°, defaulting to 0°. Studio MUST save the rotation with the widget and apply it only to that pane's view without reconnecting to the stream.

#### Scenario: View a sideways camera

- **GIVEN** a Camera pane showing a landscape frame
- **WHEN** the user selects 90° in widget options
- **THEN** the pane shows the full frame rotated clockwise in portrait orientation

### Requirement: Pick the next unused camera

A newly added Camera widget SHALL select the first camera alphabetically among advertised cameras that no other Camera widget on the same dashboard has selected. If no unused camera is advertised when the widget is added, it MUST stay unassigned until the user picks a camera. New advertisements MUST NOT change an existing pane's selection, including an unassigned pane.

#### Scenario: Add several Camera widgets

- **GIVEN** the live connection advertises `Rear` and `Front`, in that order
- **AND** a Camera widget on a different dashboard has selected `Front`
- **WHEN** the user adds three Camera widgets to this dashboard
- **THEN** the widgets select `Front`, `Rear`, and no camera, respectively
- **AND** the third widget offers both cameras in its picker

#### Scenario: Add a Camera widget before connecting

- **GIVEN** the user adds a Camera widget with no live connection
- **WHEN** the user connects and `Front` is advertised
- **THEN** the widget offers `Front` without selecting it

### Requirement: Save the camera name

Studio SHALL save the selected camera's name, not its stream URLs, with the dashboard, including shared dashboards and dashboard links. The widget MUST resolve the name against the selected live connection. If the connected server doesn't advertise the name, the pane MUST show that the selected camera is unavailable and let the user pick a different advertised camera, without changing the saved selection on its own.

#### Scenario: Open a shared dashboard on a different network

- **GIVEN** a shared dashboard has a Camera widget set to `Front`
- **WHEN** the user opens the dashboard and their live connection advertises `Front` at a different address
- **THEN** the widget uses the newly advertised address

### Requirement: Stream only while visible and following live

A Camera widget SHALL stream only while its pane is visible and the selected source is in live follow. On pause or seek back, it MUST stop streaming and offer "Go live" to resume. With no source, a log, or an explicit disconnect, it MUST stop streaming and say it needs a live connection. Changing dashboards or zooming another pane MUST stop streaming for the hidden pane. None of these actions may change the camera selection.

#### Scenario: Review live history

- **GIVEN** a pane is showing a live camera
- **WHEN** the user scrubs back to the start of autonomous
- **THEN** the pane shows "Go live" instead of any camera image
- **WHEN** the user presses "Go live"
- **THEN** the timeline follows the newest data and the pane resumes the selected feed

#### Scenario: Zoom a different pane

- **GIVEN** a dashboard has one Camera widget showing `Front` next to a graph
- **WHEN** the user zooms the graph pane
- **THEN** Studio stops requesting frames from `Front`
- **AND** unzooming resumes the feed if the dashboard is still following live data

#### Scenario: Switch to a log while connected

- **GIVEN** a Camera widget is showing `Front` on a live session
- **WHEN** the user opens a log that contains recorded camera advertisements
- **THEN** the pane stops the live stream and explains that a live connection is required
- **AND** it keeps `Front` selected without requesting any of the log's advertised addresses

### Requirement: Recover a camera feed

If an advertised address fails, Studio SHALL try other advertised addresses for the same camera. If no address delivers frames, the pane MUST show that the feed is unavailable instead of leaving a stale frame visible. It MUST retry automatically while the pane is visible, the timeline is in live follow, and the active connection still advertises the selected camera.

#### Scenario: The first address is unreachable

- **GIVEN** `Front` advertises an unreachable hostname and a reachable IP address
- **WHEN** a Camera widget starts `Front`
- **THEN** the pane shows the feed from the reachable address without asking the user to enter it

#### Scenario: Camera stops sending frames

- **GIVEN** the selected camera is still advertised and was showing frames
- **WHEN** none of its addresses delivers frames anymore
- **THEN** the pane shows the feed is unavailable instead of the last frame
- **AND** the feed resumes if frames become available again while the pane is visible and following live

### Requirement: Keep a working feed while reconnecting

During an unexpected NetworkTables outage, an already playing feed SHALL stay visible while frames keep arriving and the pane is still visible in live follow. The pane MUST indicate that Studio is reconnecting to robot data without obscuring the feed. Studio MUST wait for fresh camera advertisements before starting or switching a feed after the connection drops.

#### Scenario: NetworkTables drops but the camera still works

- **GIVEN** a pane is showing a live camera
- **WHEN** the NetworkTables connection drops unexpectedly but the camera keeps sending frames
- **THEN** the pane continues showing the live feed with a reconnecting indicator for robot data
- **WHEN** the user explicitly disconnects the live session
- **THEN** the pane stops the feed and does not retry

### Requirement: Platform support

The desktop app SHALL play compatible reachable feeds. The web app SHALL play them wherever the browser allows direct access, without a relay. If the browser needs local network permission, the widget MUST explain that access is needed. If the browser blocks the stream, the widget MUST suggest using the desktop app.

#### Scenario: Browser blocks the robot camera

- **GIVEN** the browser allows Studio's NetworkTables connection but blocks the selected camera's HTTP stream
- **WHEN** the user follows live data
- **THEN** the pane suggests using the desktop app and keeps the selected camera name

### Requirement: No camera frame history

Studio MUST NOT keep a history of camera frames or include frames in saved live sessions, WPILOG exports, or dashboard video exports. On platforms with Copy image, copying a pane or dashboard image SHALL include the frame then visible in the camera pane. Video export preview and output MUST show that the camera is live only instead of any camera frame.

#### Scenario: Copy an image and export a video

- **GIVEN** a dashboard showing a live camera on a platform that supports capture
- **WHEN** the user chooses Copy image
- **THEN** the copied image includes the frame shown in the camera pane
- **WHEN** the user exports a video of the live history
- **THEN** the preview and saved video identify the camera as live only and contain no camera footage
