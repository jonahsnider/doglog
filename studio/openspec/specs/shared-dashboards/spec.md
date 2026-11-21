# shared-dashboards Specification

## Purpose

Define how people edit shared dashboards together in real time over the internet or through a robot. An organization can share the same dashboards with its members in Cloud and with guests connected to its linked robots. Sharing on a robot can also work without Cloud or an account.

## Requirements

### Requirement: Organization membership

An account MUST belong to at most one organization. A signed-in user without an organization SHALL be able to create one in Studio and become its first admin. Joining an existing organization MUST require a valid invite. Accepting an invite MUST NOT switch a user out of their current organization. Studio MUST NOT offer an organization picker; users switch accounts by signing out in Settings and signing in with another account.

#### Scenario: Start an organization

- **GIVEN** the signed-in user does not belong to an organization
- **WHEN** they create an organization in Studio
- **THEN** they become its first admin

#### Scenario: Open an invite while already a member

- **GIVEN** the signed-in user already belongs to an organization
- **WHEN** they try to join another organization through an invite
- **THEN** they do not join the other organization or leave their current one

### Requirement: Dashboard ownership and roles

Dashboards shared in Cloud SHALL belong to the organization, not to the member who shared them. Every member MUST be able to see and edit every Cloud dashboard in their organization. Only admins may manage membership, invites, and robot links. An organization MUST NOT have viewer roles or per-dashboard permissions.

#### Scenario: A dashboard's creator leaves

- **GIVEN** a member shared a tuning dashboard in Cloud
- **WHEN** that member is removed from the organization
- **THEN** the dashboard stays shared and the other members can still edit it

### Requirement: Invite links

An admin SHALL be able to create and revoke reusable invite links for their organization. A link MUST be tied to the admin who created it, not to an invitee or email address, and MUST have no expiration or use limit. Any account that doesn't belong to an organization can join with a valid link. A link MUST stop working if it is revoked or its creator loses admin rights in that organization.

#### Scenario: Reuse a team invite

- **GIVEN** an admin posts an invite link where the team can find it
- **WHEN** two accounts without an organization use it at different times
- **THEN** both can join the organization using the same link

#### Scenario: An invite's creator loses admin rights

- **GIVEN** an admin's invite link has not been revoked
- **WHEN** an account tries to use it after the creator loses admin rights
- **THEN** the account cannot join with that link

### Requirement: Remove a member

Removing a member SHALL end their direct access to the organization's Cloud dashboards. Cloud MUST check membership when it receives an edit directly from an account, not when the edit was made. Removing a member MUST NOT recall copies they already received or block access they have independently as a robot guest. A removed member can join again with a valid invite on the same terms as an account that has never joined.

#### Scenario: Removed while offline

- **GIVEN** a member edits a cached Cloud dashboard while offline
- **WHEN** an admin removes them before Cloud receives the edit
- **THEN** Cloud rejects the edit when the former member reconnects and tries to upload it

### Requirement: Shared section

The sidebar SHALL list Cloud and robot-only dashboards once each in a single Shared section below device-only dashboards. The empty space below Shared MUST also accept dropped dashboards and panes for sharing. The section MUST show sync status (ex. "Synced with 581") while connected, "Disconnected" for 5 minutes after the last sharing connection drops, and no status otherwise.

#### Scenario: No shared dashboards

- **GIVEN** sharing is available but there are no shared dashboards
- **WHEN** a user drags a dashboard or pane
- **THEN** the Shared section explains that dropping it there shares it

#### Scenario: Data source on the same robot

- **GIVEN** the data source is connected to the robot shared dashboards are synced with
- **THEN** the Shared section shows "Synced"

#### Scenario: Not connected

- **GIVEN** shared dashboards were syncing
- **WHEN** the last sharing connection drops
- **THEN** the Shared section shows "Disconnected" for 5 minutes
- **AND** shared dashboards can still be edited, and the changes sync once connected

#### Scenario: Never connected

- **GIVEN** Studio has not connected to Cloud or a robot for sharing since opening
- **THEN** the Shared section doesn't show a status

### Requirement: Share a dashboard

Users SHALL be able to share a dashboard by dragging it into the Shared section, by dropping a pane there, or with Share in the dashboard's menu. For a signed-in member, these actions SHALL share the dashboard to their organization without asking them to choose a destination. A signed-out user SHALL be able to share on the connected robot without a Cloud account. A newly shared dashboard MUST appear in the Shared section of the people it is shared with without any action on their part.

#### Scenario: Share to an organization

- **GIVEN** a member is signed in and connected to Cloud, with no robot connected
- **WHEN** they drag a dashboard into the Shared section
- **THEN** it appears in Shared for the other connected members
- **AND** another member can open it later even if the person who shared it has gone offline

#### Scenario: Share without an account

- **GIVEN** two signed-out users are connected to the same real robot for sharing
- **WHEN** one chooses Share in a dashboard's menu
- **THEN** the dashboard shows up in the Shared section of the other

#### Scenario: Drop a pane

- **GIVEN** sharing is available
- **WHEN** a user drops a pane on the Shared section
- **THEN** the pane moves to a new shared dashboard

### Requirement: Edit together

Edits SHALL sync in real time over active sharing paths and within one second between peers on the same robot. Concurrent changes MUST merge without discarding independent edits. Only the dashboard's name, pane layout, widget settings, and bindings SHALL sync. Logs, live values, the data source, timeline cursor, focused pane, and zoomed pane MUST stay local. Undo MUST undo only the user's own edits.

#### Scenario: Edit the same widget at once

- **GIVEN** two people have the same shared dashboard open
- **WHEN** one adds an entry to a graph while the other changes the color of another entry on it
- **THEN** both see the graph with the added entry and the changed color

#### Scenario: Split the same pane at once

- **WHEN** two people split the same pane at the same moment
- **THEN** both see the same layout, with every pane kept

#### Scenario: Different sources

- **GIVEN** two people have the same shared dashboard open, one connected live and one replaying a log
- **WHEN** one of them edits the layout and scrubs the timeline
- **THEN** the other sees the layout change but keeps their own data source and timeline position

### Requirement: Offline Cloud editing

A signed-in member SHALL be able to open and edit previously synced Cloud dashboards while offline. On reconnect, pending edits MUST merge with missed edits if the account still has access. Publishing a new Cloud dashboard, changing membership or invites, and changing robot links MUST require a live Cloud connection and MUST NOT be queued while offline.

#### Scenario: Merge changes after reconnecting

- **GIVEN** a member opens a previously synced Cloud dashboard while offline
- **WHEN** they split one pane while an online member edits a widget in another pane
- **AND** the offline member reconnects with access to the dashboard
- **THEN** both members see the split and the widget edit

### Requirement: Signing out

Signing out SHALL hide the dashboards available through that account and keep pending Cloud edits associated with that account. Studio MUST only resume upload of those edits when the same account signs in again and still has access. Signing out MUST NOT prevent the user from seeing a dashboard shared through the robot as a guest.

#### Scenario: Switch accounts with pending edits

- **GIVEN** a member has pending edits to a Cloud dashboard
- **WHEN** they sign out and sign in with another account
- **THEN** the other account does not inherit the previous account's Cloud access or upload its edits

### Requirement: Stop sharing

Dragging a robot-only dashboard out of the Shared section, or Stop sharing in its menu, SHALL stop sharing it for everyone: it disappears for others, and the user who stopped sharing it keeps a copy on their device.

#### Scenario: Drag a dashboard out

- **GIVEN** a robot-only dashboard is shared with two other laptops
- **WHEN** a user drags it out of the Shared section
- **THEN** it's listed with their other dashboards
- **AND** it disappears from the other laptops

### Requirement: Close a shared dashboard

Closing a shared dashboard SHALL remove it from Shared for everyone, including when a guest closes it from a linked robot. Closing MUST require an active sharing connection for that dashboard, either through Cloud or a robot, and MUST NOT be queued when neither path is connected. Reopening it with Reopen closed dashboard MUST bring it back for everyone. For a robot-only dashboard, devices that missed the close MUST learn of it on reconnect for at least 30 days, instead of sharing it again.

#### Scenario: Close and reopen

- **GIVEN** a dashboard is shared with another laptop
- **WHEN** a user closes it, then reopens it
- **THEN** it disappears from the other laptop, then comes back

#### Scenario: A guest closes a Cloud dashboard

- **GIVEN** a guest has a Cloud dashboard open through a linked robot
- **WHEN** the guest closes it on the robot sharing connection
- **THEN** it disappears for the robot's peers
- **AND** it disappears for Cloud members once an authorized Studio relays the close

#### Scenario: Close while disconnected

- **GIVEN** a user has a cached shared dashboard open with neither sharing path connected for it
- **WHEN** they try to close the dashboard
- **THEN** Studio does not close it or queue a close for later

#### Scenario: Closed while away

- **GIVEN** a laptop with a robot-only dashboard is turned off
- **WHEN** someone closes the dashboard, and the laptop reconnects to the robot the next day
- **THEN** the dashboard disappears from that laptop instead of coming back for everyone

### Requirement: Shared on a robot

Robot-only dashboards SHALL belong to the robot set in Settings. Robot-only dashboards shared on another robot MUST NOT be shown or sent while connected to a different robot. Simulators MAY be data sources but MUST NOT be used for dashboard sharing, including as a fallback for robot-only sharing.

#### Scenario: Only the simulator is reachable

- **GIVEN** the configured robot is unavailable and a simulator is running
- **WHEN** the user connects to the simulator as a data source
- **THEN** Studio can show the simulator's live data without syncing dashboards through it

#### Scenario: Help another team

- **GIVEN** a user has robot-only dashboards shared on team 581's robot
- **WHEN** they change the robot connection to team 254
- **THEN** team 581's shared dashboards are hidden, and aren't sent to team 254's robot

### Requirement: Link robots to an organization

An admin SHALL be able to link and unlink multiple real robot targets independently. Connecting to a robot MUST NOT link it by itself. Team numbers and IP addresses are connection targets, not Cloud identities or credentials. When Studio bridges a linked robot, it MUST make all the organization's Cloud dashboards available on that robot, with no per-dashboard robot selection. Studio MUST NOT send Cloud dashboards to an unlinked robot.

#### Scenario: Share across team numbers

- **GIVEN** an admin links the varsity robot and a robot with a different offseason team number
- **WHEN** a member's Studio bridges either linked robot to Cloud
- **THEN** peers on that robot can see every dashboard shared in the organization's Cloud

#### Scenario: Connect to an unrelated robot

- **GIVEN** a signed-in member has Cloud dashboards in Shared
- **WHEN** they connect to a robot their organization hasn't linked
- **THEN** their Cloud dashboards stay available to the member but are not shared to that robot

### Requirement: Move a robot-only dashboard to Cloud

Linking a robot MUST NOT upload any of its existing robot-only dashboards. An organization member SHALL be able to explicitly move a robot-only dashboard into the organization's Cloud while connected to Cloud, without leaving a second independently editable copy on the robot.

#### Scenario: Link a robot that already has dashboards

- **GIVEN** a robot already has a robot-only dashboard
- **WHEN** an admin links the robot to the organization
- **THEN** the dashboard stays robot-only until a member explicitly moves it to Cloud

### Requirement: Sync Cloud with a linked robot

Cloud SHALL keep a durable copy of each Cloud dashboard. A member's Studio SHALL sync the same dashboards both ways while connected to Cloud and a linked robot, without new robot software or an always-on bridge. Studio MUST check the robot's link before resuming the bridge on reconnect and stop bridging when it learns the robot was unlinked. Unlinking MUST NOT recall copies or undo changes already synced.

#### Scenario: A robot is unlinked while a bridge is disconnected

- **GIVEN** Studio was bridging a linked robot before going offline
- **WHEN** an admin unlinks that robot and Studio reconnects
- **THEN** Studio does not resume bridging the robot
- **AND** changes already synced to Cloud remain there

### Requirement: Robot guests

Anyone connected to a linked robot for sharing SHALL be able to receive, edit, and close dashboards exposed there without signing in. This MUST NOT grant membership, direct Cloud access, organization browsing, or admin rights. Guest changes SHALL reach Cloud when a Studio authorized to bridge that robot receives and relays them. If no bridge is active when the guest edits, a device carrying the change must sync with an authorized Studio later for it to reach Cloud.

#### Scenario: Guest edits without a bridge

- **GIVEN** a guest has an organization's dashboard through a linked robot and no Studio is bridging it
- **WHEN** the guest adds a graph using the robot sharing connection
- **THEN** Cloud members do not see the graph yet
- **AND** the graph appears for them when a device carrying the edit syncs with a Studio that relays it to Cloud

### Requirement: Sync connection

Studio SHALL connect to the configured robot for sharing whenever the app is open, separately from the active data source. It MUST NOT ask for local network access for sharing unless the user has shared dashboards. Changing the robot connection setting MUST NOT reconnect unless it points to a different robot, so editing it doesn't interrupt syncing.

#### Scenario: Reviewing a log in the pits

- **GIVEN** a user is replaying a log while the robot is on
- **THEN** shared dashboards stay in sync with others connected to the robot

#### Scenario: Editing the robot connection

- **GIVEN** shared dashboards are synced with a robot
- **WHEN** a user types an IP address into the robot connection setting
- **THEN** sharing stays connected until the address is complete

### Requirement: Presence

Shared dashboards SHALL show each other tab or window as a stacked sidebar avatar and on the header of the pane it last interacted with. A user's own sessions MUST be hidden. For each other user, only their last focused or used tab or window MUST look active; the rest are grayed out. Avatars MUST disappear when a session closes, disconnects, or leaves the dashboard. Presence MUST cross an active bridge between Cloud and a robot and MUST NOT be saved or replayed.

#### Scenario: See a guest from Cloud

- **GIVEN** Studio is bridging a shared dashboard between Cloud and a linked robot
- **WHEN** a robot guest interacts with a pane
- **THEN** members viewing the dashboard in Cloud see the guest's presence on that pane

#### Scenario: Several windows

- **GIVEN** a user has a shared dashboard open in two windows
- **WHEN** they click in one window
- **THEN** others see that window's avatar as active and the other window's avatar grayed out

#### Scenario: Close a window

- **WHEN** a user closes a window showing a shared dashboard
- **THEN** its avatar disappears for others

### Requirement: Identity

Others SHALL see each user by the name set in Settings. Users without a name MUST be shown as "Anonymous" followed by a dog breed that stays the same on their device, and the first time they open a shared dashboard they MUST be prompted to set a name.

#### Scenario: No name set

- **GIVEN** the user hasn't set a name
- **WHEN** they open a shared dashboard for the first time
- **THEN** they're shown as, ex., "Anonymous Corgi"
- **AND** a toast offers to set their name
