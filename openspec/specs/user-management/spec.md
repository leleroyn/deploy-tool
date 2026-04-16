# user-management Specification

## Purpose
Manage user accounts, profiles, roles, and authentication status.

## Requirements
### Requirement: User profile persistence
The system MUST store user profiles in a persistent database. A profile SHALL include a unique username, a hashed password, a role, a frozen status, and an avatar.

#### Scenario: Successful user creation
- **WHEN** a new user is added to the system
- **THEN** the system MUST persist the user information in the database with the specified role and default `is_frozen=false` status.

### Requirement: User role management
The system MUST support assigning roles to users. Roles SHALL include `system_admin` and `ops_admin`.

#### Scenario: Admin user initialization
- **WHEN** the system starts for the first time
- **THEN** the system MUST automatically create a default user with username `admin`, password `admin123`, and role `system_admin`.

### Requirement: Account freezing
The system MUST allow accounts to be marked as frozen. A frozen account SHALL NOT be allowed to authenticate.

#### Scenario: Attempt login with frozen account
- **WHEN** a user attempts to log in with a username that is marked as `is_frozen=true`
- **THEN** the system MUST deny authentication and return an error.

### Requirement: Profile update
The system SHALL allow users to update their personal profile information.

#### Scenario: Successful profile update (avatar)
- **WHEN** a user uploads a new avatar image (within size limits)
- **THEN** the system SHALL persist the avatar (as a base64 string) in the database and reflect it in the UI.

#### Scenario: Successful password update
- **WHEN** a user submits a valid current password and a new password
- **THEN** the system SHALL update the password in the database and show a success message.

### Requirement: Admin user list
The system SHALL provide a view for administrators to see a list of all users in the system.

#### Scenario: Viewing user list
- **WHEN** an administrator accesses the User Management page
- **THEN** the system SHALL display a table containing all users, their roles, and their status (frozen/active).

### Requirement: User role/status management
The system SHALL allow administrators to modify the role and frozen status of any user.

#### Scenario: Freezing a user
- **WHEN** an administrator toggs the "frozen" status for a user
- **THEN** the system SHALL persist this change and immediately prevent that user from logging in.

#### Scenario: Changing a user role
- **WHEN** an administrator changes a user's role (e.g., from `ops_admin` to `system_admin`)
- **THEN** the system SHALL persist this change in the database.

