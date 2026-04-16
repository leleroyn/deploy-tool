## Why

Current user authentication and session management lack persistence, meaning user data and active sessions are lost upon server restart. This prevents effective user management (like roles and account freezing) and reliable session handling.

## What Changes

- **Persistent User Storage**: User credentials and profiles will be stored in a database instead of in-memory.
- **User Attributes**: Added support for user roles (e.g., `system_admin`, `ops_admin`) and an account `frozen` status.
- **Default Admin**: Initialization of a default `admin` user with password `admin123` and role `system_admin`.
- **Persistent Sessions**: Authentication tokens will be stored in the database to allow for session management and validation across restarts.

## Capabilities

### New Capabilities

- `user-management`: Manages user profiles, roles, and account status (frozen/active) within the database.
- `session-management`: Manages persistent authentication tokens and session validation via the database.

### Modified Capabilities

- `user-authentication`: Changes requirements to authenticate users against a database and validate tokens against stored session data.

## Impact

- User management and authentication services.
- Database schema (new `users` and `sessions` tables).
- Authentication API endpoints (Login, Logout, Token Validation).
