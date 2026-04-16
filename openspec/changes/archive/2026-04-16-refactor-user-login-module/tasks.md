## 1. Environment Setup

- [x] 1.1 Install `better-sqlite3` and `@types/better-sqlite3` in `server/`
- [x] 1.2 Create database initialization script (schema creation)

## 2. Database Layer

- [x] 2.1 Implement `User` repository/service to handle DB operations (CRUD, role, frozen status)
- [x] 2.2 Implement `Session` repository/service to handle DB operations (token management)

## 3. Refactor Authentication Module

- [x] 3.1 Update `server/src/auth.ts` to use `User` and `Session` services instead of in-memory storage
- [x] 3.2 Implement default `admin` user creation logic in the DB
- [x] 3.3 Update `login` to create a new session in the DB
- [x] 3.4 Update `verifyToken` to check the `sessions` table
- [x] 3.5 Update `logout` to remove the session from the DB

## 4. Integration and Verification

- [x] 4.1 Update `server/src/index.ts` to run DB initialization on startup
- [x] 4.2 Verify authentication flow (login, access protected routes, logout)
- [x] 4.3 Verify role and frozen status enforcement
- [x] 4.4 Verify session persistence after server restart

