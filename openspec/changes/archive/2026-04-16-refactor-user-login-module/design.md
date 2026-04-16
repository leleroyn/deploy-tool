## Context

Currently, user authentication and session management are handled in-memory in `server/src/auth.ts`. This means all user information and active sessions are lost whenever the server restarts. Furthermore, there is no way to manage user roles or freeze accounts.

## Goals / Non-Goals

**Goals:**

- Implement persistent user storage using SQLite.
- Support user roles (`system_admin`, `ops_admin`) and an `is_frozen` status.
- Implement persistent session management by storing authentication tokens in the database.
- Automatically initialize a default `admin` user.

**Non-Goals:**

- Implementing complex RBAC (Role-Based Access Control).
- Implementing a full-blown user registration UI.

## Decisions

**Database:**
Use `better-sqlite3` for a lightweight, synchronous, and high-performance SQLite implementation.

**Schema:**
- `users` table: `id` (UUID), `username` (unique), `password_hash`, `role` (string), `is_frozen` (boolean), `created_at`.
- `sessions` table: `id` (UUID), `user_id` (FK), `token` (unique), `expires_at`, `created_at`.

**Token Generation:**
Continue using `crypto.randomBytes` for token generation, but store them in the `sessions` table.

**Authentication:**
Update `login` to check the database and insert a new session. Update `verifyToken` to check the `sessions` table.

## Risks / Trade-offs

- [Performance] Database lookups for every authenticated request. → [Mitigation] SQLite is extremely fast for local reads; we can add caching if needed later.
- [Migrations] Database schema updates. → [Mitigation] Handle schema creation on startup for this initial implementation.
