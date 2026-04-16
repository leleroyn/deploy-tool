## ADDED Requirements

### Requirement: Admin User List
The system SHALL provide a view for administrators to see a list of all users in the system.

#### Scenario: Viewing user list
- **WHEN** an administrator accesses the User Management page
- **THEN** the system SHALL display a table containing all users, their roles, and their status (frozen/active).

### Requirement: User Role/Status Management
The system SHALL allow administrators to modify the role and frozen status of any user.

#### Scenario: Freezing a user
- **WHEN** an administrator toggs the "frozen" status for a user
- **THEN** the system SHALL persist this change and immediately prevent that user from logging in.

#### Scenario: Changing a user role
- **WHEN** an administrator changes a user's role (e.g., from `ops_admin` to `system_admin`)
- **THEN** the system SHALL persist this change in the database.
