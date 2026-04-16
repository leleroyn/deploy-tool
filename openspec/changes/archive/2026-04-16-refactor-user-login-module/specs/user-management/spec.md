## ADDED Requirements

### Requirement: User profile persistence
The system MUST store user profiles in a persistent database. A profile SHALL include a unique username, a hashed password, a role, and a frozen status.

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
