# shared-dashboards Specification

## Purpose

Define how people edit shared dashboards together over the internet or through a robot. A team can sync dashboards through Cloud with end-to-end encryption and share readable dashboards with guests on explicitly linked robots. Robot-only sharing works without Cloud or an account.

## Requirements

### Requirement: Cloud accounts

Cloud accounts SHALL belong to individuals and work in the web and desktop apps. Users SHALL be able to delete their own Cloud account and edit the display name that teammates see. Display names need not be unique and MUST NOT be used to identify an account at sign-in. Signing in MUST NOT be required to use local dashboards or share dashboards on a robot without Cloud.

#### Scenario: Use Studio without a Cloud account

- **WHEN** a signed-out user opens Studio
- **THEN** they can use local dashboards and robot-only sharing without signing in

### Requirement: Cloud sign-in methods

Studio SHALL offer Sign in with Apple, Sign in with Google, and passkey sign-in. A user MUST be able to create and use an account with only a passkey, without a username or an Apple, Google, school, or team-managed account. DogLog MUST NOT ask for, store, or reset account passwords. A signed-in user still needs their account's encryption credential to open Cloud dashboards.

#### Scenario: Create an account with just a passkey

- **GIVEN** a user has no Cloud account
- **WHEN** they create an account with a display name and a passkey
- **THEN** they can create and sign in to their Cloud account without connecting an identity provider

#### Scenario: Sign in with a saved passkey

- **GIVEN** a user has saved a passkey for their Cloud account
- **WHEN** they choose passkey sign-in and select that passkey
- **THEN** Studio signs them in to the account associated with the passkey without asking for a name

### Requirement: Linked sign-in methods

A signed-in user SHALL be able to add passkeys and link Apple and Google to their account, so any of them signs in to the same account. Adding a passkey MUST NOT require an existing one. Users SHALL be able to see each passkey, remove passkeys, and unlink Apple and Google, but MUST NOT be able to remove their account's last way to sign in. An Apple or Google account that already signs in to a different Cloud account MUST NOT be linked, and that account MUST be unchanged.

#### Scenario: Link Google to a passkey account

- **GIVEN** a user created their account with a passkey
- **WHEN** they link Google from the Cloud page and later choose Sign in with Google
- **THEN** Studio signs them in to the same account

#### Scenario: Link an Apple or Google account used by another account

- **GIVEN** a Google account already signs in to a different Cloud account
- **WHEN** a user tries to link that Google account
- **THEN** Studio says it belongs to a different account and neither account changes

#### Scenario: Remove the last way to sign in

- **GIVEN** an account can only sign in with Google
- **WHEN** the user tries to unlink Google
- **THEN** Studio asks them to add another way to sign in first and Google stays linked

### Requirement: Desktop sign-in

The desktop app SHALL sign in without leaving the app when the OS provides the chosen method, ex. passkeys and Sign in with Apple on macOS. Otherwise, it SHALL open sign-in in the default browser and return the user to the app signed in. A browser sign-in MUST only sign in the app that started it. Passkeys MUST work the same in the web and desktop apps.

#### Scenario: Sign in with a passkey in the macOS app

- **GIVEN** a user created their account with a passkey in the web app
- **WHEN** they sign in with that passkey in the desktop app on macOS
- **THEN** they are signed in without a browser opening

#### Scenario: Sign in with Google in the desktop app

- **WHEN** a user chooses Sign in with Google in the desktop app
- **THEN** Google's sign-in opens in their default browser, and once they finish, the desktop app is signed in to that account

### Requirement: Team membership

An account MUST belong to at most one team. When Cloud is available, Studio SHALL offer account and team management on the Cloud page in the sidebar. A signed-in user with neither a team nor a valid pending join SHALL be able to create a team there and become its first admin. Joining a team MUST require a valid invite. Accepting an invite MUST NOT switch the account's team. Studio MUST NOT offer a team picker; users switch accounts by signing out and back in on the Cloud page.

#### Scenario: Find Cloud settings

- **WHEN** a signed-in user opens the Cloud page
- **THEN** the Team section contains team creation, joining, and membership controls as applicable
- **AND** the Collaboration section contains display name and invite links for admins
- **AND** the Account section contains encryption, sign-in methods, sign-out, and account deletion controls

#### Scenario: Start a team

- **GIVEN** the signed-in user does not belong to a team and has no valid pending join
- **WHEN** they create a team in Studio
- **THEN** they become its first admin

#### Scenario: Wait to join a team

- **GIVEN** the signed-in user has accepted a valid invite and the join is still pending
- **WHEN** they open the Cloud page
- **THEN** Studio shows the pending join instead of the team creation form
- **AND** team creation becomes available again if the invite is revoked and no other valid pending join remains

#### Scenario: Open an invite while already a member

- **GIVEN** the signed-in user already belongs to a team
- **WHEN** they try to join another team through an invite
- **THEN** they do not join the other team or leave their current one

### Requirement: Dashboard ownership and roles

Dashboards shared in Cloud SHALL belong to the team, not to the member who shared them. Every member MUST be able to see and edit every Cloud dashboard in their team. Only admins may manage other accounts' membership, invite links, and robot links. A team MUST NOT have viewer roles or per-dashboard permissions.

#### Scenario: A dashboard's creator leaves

- **GIVEN** a member shared a tuning dashboard in Cloud
- **WHEN** that member leaves the team or deletes their account
- **THEN** the dashboard stays shared and the other members can still edit it

### Requirement: Change admin rights

Admins SHALL be able to promote members to admin and remove admin rights from themselves or another admin, as long as the team still has an admin. Losing admin rights does not end membership or change dashboard access.

#### Scenario: The last admin tries to step down

- **GIVEN** a team has one admin
- **WHEN** that admin tries to step down
- **THEN** they must make another member an admin first

### Requirement: Leave or delete a team

A member SHALL be able to leave their team without deleting their account. Deleting an account MUST NOT delete dashboards owned by a team. Before leaving or deleting their account, the last admin MUST make another member an admin or, if alone, delete the team. An admin SHALL be able to delete the team and its Cloud dashboards only when they are its sole remaining member.

#### Scenario: Deletion is unavailable

- **WHEN** a signed-in user cannot delete their account or cannot delete the team they belong to
- **THEN** the corresponding delete action remains visible and disabled
- **AND** it explains why deletion is unavailable without opening a confirmation dialog

#### Scenario: The last admin tries to leave

- **GIVEN** a team has one admin and another member
- **WHEN** the admin tries to leave or delete their account
- **THEN** they must make another member an admin first

#### Scenario: Delete a team with no other members

- **GIVEN** the admin is the only member of a team
- **WHEN** they delete the team
- **THEN** its Cloud dashboards are deleted and the admin keeps their account without a team

### Requirement: Invite links

Each admin SHALL be able to create and revoke one reusable invite link with no expiration or use limit. A signed-in account without a team can join with a valid link without another approval. Losing admin rights MUST invalidate the link permanently, even if its creator becomes an admin again. The link MUST NOT contain a dashboard decryption key or unlock dashboards by itself.

#### Scenario: Reuse a team invite

- **GIVEN** an admin posts an invite link where the team can find it
- **WHEN** two signed-in accounts without a team use it at different times
- **THEN** both can join the team using the same link without a separate approval

#### Scenario: An invite's creator loses admin rights

- **GIVEN** an admin's invite link has not been revoked
- **WHEN** an account tries to use it after the creator loses admin rights, even if the creator has regained those rights
- **THEN** the account cannot join with that link

### Requirement: Pending invite redemption

If no authorized teammate's Studio can unlock the team key, the join SHALL stay pending without granting membership or dashboard access. Cloud MUST reject team creation while the account has a valid pending join. Studio MUST complete the join automatically when an authorized teammate's Studio can unlock the key, provided the invite is still valid, the account still has no team, and the invitee's account key is verified. Neither person needs to compare a verification code.

#### Scenario: A teammate comes online after invite acceptance

- **GIVEN** a signed-in account without a team and with a verified account key has accepted a valid invite, but no authorized teammate's Studio can unlock the team key
- **WHEN** an authorized teammate's Studio comes online, unlocks the key, and verifies the invite is still valid
- **THEN** the account joins the team and gains dashboard access without another approval

#### Scenario: Revoke a pending invite

- **GIVEN** a join is pending because no authorized teammate's Studio is available
- **WHEN** the invite is revoked before the handoff can complete
- **THEN** the account does not join or receive the team key when the handoff is attempted

### Requirement: Cancel a pending join

The invitee SHALL be able to cancel their own pending join without revoking the invite link or affecting other pending joins. Once canceled, the request MUST NOT grant membership or dashboard access.

#### Scenario: Cancel the last pending join

- **GIVEN** a signed-in user has one valid pending join
- **WHEN** they cancel the join before it completes
- **THEN** Studio removes the pending join and offers team creation again

### Requirement: Remove a member

Admins SHALL be able to remove any other team member, including another admin. Leaving or removal SHALL end direct access to the team's Cloud dashboards. Cloud MUST reject edits made under an ended membership, even if the account rejoins. Ending membership cannot recall copies already received and MUST NOT block independent access as a robot guest. Former members can join again with a valid invite on the same terms as first-time members.

#### Scenario: Removed while offline

- **GIVEN** a member edits a cached Cloud dashboard while offline
- **WHEN** an admin removes them before Cloud receives the edit
- **THEN** the edit does not sync when the former member reconnects

#### Scenario: Rejoin with unsynced edits

- **GIVEN** an account has unsynced edits from before it was removed from the team
- **WHEN** the account rejoins with a valid invite
- **THEN** it can open and edit the team's current dashboards, but its old edits do not sync

### Requirement: Cloud dashboard confidentiality

Studio MUST encrypt dashboard names and entry names before sending data to Cloud. Cloud MUST NOT receive those names or their decryption keys in edits, snapshots, derived labels, previews, or diagnostics. Other dashboard data and metadata need not be confidential. This protection assumes users trust the Studio code they run and the live Cloud service correctly attests account keys and authorizes grants. A compromised live service could misdirect a grant.

#### Scenario: Cloud operator inspects a dashboard

- **GIVEN** a team syncs a named dashboard with entry bindings
- **WHEN** an operator inspects the sync traffic, database, backups, or diagnostics without changing the live service or Studio code
- **THEN** they cannot read its dashboard name or entry names

### Requirement: Pair Studio on a new device

Members SHALL be able to pair a new Studio with an already-unlocked Studio signed in to the same account, without admin approval. Both devices MUST display a six-digit verification code computed independently for the pairing attempt. The unlocked device MUST transfer the encryption credential only after the user confirms that the codes match. Cloud MUST NOT be able to read the transferred credential. Each pairing attempt MUST expire and work only once.

#### Scenario: Pair Studio on a new device

- **GIVEN** a team member can open Cloud dashboards on one device
- **WHEN** they start pairing on another device signed in to the same account, compare the two codes, and confirm the match on the unlocked device
- **THEN** they can open the team's dashboards on the new device without admin approval

#### Scenario: Cancel a pairing attempt

- **GIVEN** both devices show a verification code for a pairing attempt
- **WHEN** the codes differ and the member cancels, or the attempt expires before they confirm
- **THEN** Studio does not transfer the credential and the member must start a new attempt to pair

### Requirement: Grant dashboard access to an account

Studio MUST grant dashboard access to accounts, not devices. Before sealing the team key on join, a member's Studio MUST verify the invite is current and Cloud's attestation that the recipient key belongs to the joining account. Grants MUST be bound to their team, recipient, and key version, and Cloud MUST only accept grants from members holding the current key. Stored records and public keys alone MUST NOT authorize a grant, and a revoked invite MUST NOT be accepted.

#### Scenario: A stored account key is substituted

- **GIVEN** an account uses a valid invite to join a team
- **WHEN** the database returns a different public key without a valid Cloud attestation for that key and account
- **THEN** Studio does not encrypt the team key to the substituted key or complete the join

#### Scenario: Open retained history after joining

- **GIVEN** a team has existing dashboards and retained edits encrypted with its current key
- **WHEN** a new account joins the team
- **THEN** it receives access to the current dashboards and may read retained history encrypted with that key
- **AND** joining does not rotate the team key or require sharing keys from earlier rotations

### Requirement: Recover dashboard access

Cloud MUST NOT be able to unlock account private keys. If a member loses their credential, an admin who can still open the dashboards SHALL be able to verify the member and grant a replacement credential for the same account. Studio MUST rotate the team key and exclude the lost credential. If nobody on the team can unlock the dashboards, signing in again or contacting support MUST NOT restore access to the protected data.

#### Scenario: Replace one member's lost credential

- **GIVEN** a member has lost their encryption credential and an admin can still open the team's dashboards
- **WHEN** the admin verifies the member and authorizes a replacement credential
- **THEN** the same account can open the dashboards with the replacement credential

#### Scenario: No member can unlock the team key

- **GIVEN** no member can recover a credential that can unlock the team key
- **WHEN** an admin regains access to their Cloud account
- **THEN** they still cannot decrypt the existing dashboards

### Requirement: Rotate dashboard keys on member removal

When a membership ends, Studio MUST generate a fresh team key that cannot be derived from a previous key and grant it only to remaining members. Studio MUST verify the current team state with Cloud before publishing. After removal takes effect, Cloud MUST NOT accept or distribute new edits encrypted with the old key. If Studio cannot verify team state or unlock the current key, it MUST keep edits local. Rotation cannot revoke keys or copies a former member already holds.

#### Scenario: A remaining member reconnects after rotation

- **GIVEN** a remaining member edits a dashboard offline while another member is removed and the team key is rotated
- **WHEN** the remaining member reconnects
- **THEN** their pending edits sync under the new key and merge with the other members' edits
- **AND** the former member cannot decrypt the new Cloud updates using their old key

#### Scenario: Open a dashboard with only the current key

- **GIVEN** a new member joined after a key rotation and received only the current key
- **WHEN** they open an existing Cloud dashboard while other members are offline
- **THEN** they can decrypt the current dashboard without needing an earlier key

#### Scenario: A stale upload arrives after removal

- **GIVEN** a remaining member's Studio prepared an edit with the old key before a removal took effect
- **WHEN** the upload arrives after the removal takes effect
- **THEN** Cloud rejects the old-key upload without distributing it and Studio keeps the edit local until it can sync under the current key

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

Users SHALL be able to share a dashboard by dragging it into the Shared section, by dropping a pane there, or with Share in the dashboard's menu. For a signed-in member, these actions SHALL share the dashboard to their team without asking them to choose a destination. A signed-out user SHALL be able to share on the connected robot without a Cloud account. A newly shared dashboard MUST appear in the Shared section of the people it is shared with without any action on their part.

#### Scenario: Share to a team

- **GIVEN** a member is signed in, has unlocked their Cloud dashboards, and is connected to Cloud with no robot connected
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

A signed-in member with an available encryption credential SHALL be able to open and edit previously synced Cloud dashboards while offline. On reconnect, pending edits MUST merge with missed edits if the account still has the membership under which it made the edits. Publishing a new Cloud dashboard, changing membership or invites, and changing robot links MUST require a live Cloud connection and MUST NOT be queued while offline.

#### Scenario: Merge changes after reconnecting

- **GIVEN** a member opens a previously synced Cloud dashboard while offline
- **WHEN** they split one pane while an online member edits a widget in another pane
- **AND** the offline member reconnects with access to the dashboard
- **THEN** both members see the split and the widget edit

### Requirement: Signing out

Signing out SHALL immediately hide the dashboards available through that account, including offline. Studio MUST keep its decryption keys and pending Cloud edits separate from other accounts. Studio MUST only resume upload of those edits when the same account signs in again and still has the membership under which it made them. Signing out MUST NOT affect local dashboards or access as a robot guest.

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

### Requirement: Link robots to a team

An admin SHALL be able to link and unlink multiple real robot targets independently. Connecting to a robot MUST NOT link it by itself. Team numbers and IP addresses are connection targets, not Cloud identities or credentials. When Studio bridges a linked robot, it MUST make all the team's Cloud dashboards available on that robot, with no per-dashboard robot selection. Studio MUST NOT send Cloud dashboards to an unlinked robot.

#### Scenario: Share across team numbers

- **GIVEN** an admin links the varsity robot and a robot with a different offseason team number
- **WHEN** a member's Studio bridges either linked robot to Cloud
- **THEN** peers on that robot can see every dashboard shared in the team's Cloud

#### Scenario: Connect to an unrelated robot

- **GIVEN** a signed-in member has Cloud dashboards in Shared
- **WHEN** they connect to a robot their team hasn't linked
- **THEN** their Cloud dashboards stay available to the member but are not shared to that robot

### Requirement: Move a robot-only dashboard to Cloud

Linking a robot MUST NOT upload any of its existing robot-only dashboards. A team member SHALL be able to explicitly move a robot-only dashboard into the team's Cloud while connected to Cloud, without leaving a second independently editable copy on the robot.

#### Scenario: Link a robot that already has dashboards

- **GIVEN** a robot already has a robot-only dashboard
- **WHEN** an admin links the robot to the team
- **THEN** the dashboard stays robot-only until a member explicitly moves it to Cloud

### Requirement: Sync Cloud with a linked robot

Cloud SHALL keep a durable copy of each Cloud dashboard, with protected names encrypted. A signed-in member's Studio with access to the team's dashboards SHALL sync the same dashboards both ways while connected to Cloud and a linked robot, without new robot software or an always-on bridge. Studio MUST check the robot's link before resuming the bridge on reconnect and stop bridging when it learns the robot was unlinked. Unlinking MUST NOT recall copies or undo changes already synced.

#### Scenario: A robot is unlinked while a bridge is disconnected

- **GIVEN** Studio was bridging a linked robot before going offline
- **WHEN** an admin unlinks that robot and Studio reconnects
- **THEN** Studio does not resume bridging the robot
- **AND** changes already synced to Cloud remain there

### Requirement: Robot guests

Anyone connected to a linked robot for sharing SHALL be able to receive, edit, and close dashboards exposed there without signing in. This MUST NOT grant membership, direct Cloud access, team browsing, or admin rights. Guest changes SHALL reach Cloud when a Studio authorized to bridge that robot receives and relays them. If no bridge is active when the guest edits, a device carrying the change must sync with an authorized Studio later for it to reach Cloud.

#### Scenario: A member bridges a dashboard

- **GIVEN** a member's Studio is bridging a Cloud dashboard to an explicitly linked robot
- **WHEN** Studio receives encrypted dashboard content from Cloud
- **THEN** it decrypts the content locally and shares a readable copy, including dashboard and entry names, over the robot connection
- **AND** the robot and guests receive no Cloud decryption keys

#### Scenario: Guest edits without a bridge

- **GIVEN** a guest has a team's dashboard through a linked robot and no Studio is bridging it
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

### Requirement: Cloud presence

Studio SHALL show one sidebar avatar per other team member with a live session on the dashboard, not per window or pane. The avatar SHALL disappear when the last session leaves or expires. Cloud MUST check current team membership on presence reads and writes.

Cloud MAY keep one last-disconnected timestamp per account and dashboard. Studio MUST NOT show offline members or last-seen times. Cloud MUST NOT keep or replay a history of presence changes.

#### Scenario: A teammate has two Cloud windows open

- **GIVEN** a teammate is viewing the same Cloud dashboard in two active windows
- **WHEN** one window closes
- **THEN** other viewers still see exactly one avatar for the teammate
- **AND** the avatar disappears when the remaining session leaves or expires

### Requirement: Robot presence

On a robot-shared dashboard, Studio SHALL show each other tab or window as a stacked sidebar avatar and on its last-used pane header. Only each user's last focused or used window SHALL look active. Avatars MUST disappear when a session closes, disconnects, or leaves. Robot presence MUST NOT be saved or replayed.

The bridge SHALL relay dashboard edits, not presence. Cloud and robot viewers MUST only see presence from their own connection.

#### Scenario: A robot guest edits a bridged dashboard

- **GIVEN** Studio is bridging a shared dashboard between Cloud and a linked robot
- **WHEN** a robot guest edits a pane
- **THEN** other robot viewers see the guest's presence on that pane
- **AND** Cloud viewers receive the edit without seeing the guest's avatar

#### Scenario: Several windows

- **GIVEN** a user has a dashboard shared through a robot open in two windows
- **WHEN** they click in one window
- **THEN** others see that window's avatar as active and the other window's avatar grayed out

#### Scenario: Close a window

- **WHEN** a user closes a window showing a dashboard shared through a robot
- **THEN** its avatar disappears for others

### Requirement: Identity

Others SHALL see signed-in users by their Cloud display name, including when sharing on a robot. Signed-out users SHALL use the name set in Settings. Users without a name MUST be shown as "Anonymous" followed by a dog breed that stays the same on their device. Signed-out users without a name MUST be prompted to set one the first time they open a shared dashboard.

#### Scenario: Cloud name changes while sharing on a robot

- **GIVEN** a signed-in user is viewing a dashboard shared through a robot
- **WHEN** they change their Cloud display name
- **THEN** other robot viewers see the updated name without reopening the dashboard

#### Scenario: No name set

- **GIVEN** the user is signed out and hasn't set a name
- **WHEN** they open a shared dashboard for the first time
- **THEN** they're shown as, ex., "Anonymous Corgi"
- **AND** a toast offers to set their name
