## ADDED Requirements

### Requirement: Persistent session tokens
The system MUST store active authentication tokens in a persistent database.

#### Scenario: Successful token generation upon login
- **WHEN** a user provides valid credentials
- **THEN** the system MUST generate a unique token and persist it in the `sessions` table, associated with the user's ID.

### Requirement: Token validation
The system MUST validate authentication tokens against the database for every authenticated request.

#### Scenario: Valid token authentication
- **WHEN** a request is made with a valid, non-expired token from the database
- **THEN** the system MUST authorize the request.

#### Scenario: Invalid or expired token authentication
- **WHEN** a request is made with a token that does not exist in the database or has expired
- **THEN** the system MUST deny authentication with a 401 error.

#### Scenario: Logout
- **WHEN** a user requests to logout
- **THEN** the system MUST delete the corresponding token from the `sessions` table.
