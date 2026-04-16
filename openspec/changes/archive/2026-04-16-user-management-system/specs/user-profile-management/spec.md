## ADDED Requirements

### Requirement: Profile Update
The system SHALL allow users to update their personal profile information.

#### Scenario: Successful profile update (avatar)
- **WHEN** a user uploads a new avatar image (within size limits)
- **THEN** the system SHALL persist the avatar (as a base64 string) in the database and reflect it in the UI.

#### Scenario: Successful password update
- **WHEN** a user submits a valid current password and a new password
- **THEN** the system SHALL update the password in the database and show a success message.

### Requirement: User Self-Service UI
The system SHALL provide a "My Profile" interface within the User Management page.

#### Scenario: Accessing My Profile
- **WHEN** a user navigs to the User Management page
- **THEN** the system SHALL display their current profile information and a form to edit it.
