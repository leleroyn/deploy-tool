## Context

The current user management is highly limited, primarily focused on authentication. There is no way for users to manage their personal profile information (like an avatar) or for administrators to have a central view of all users.

## Goals / Non-Goals

**Goals:**

- Implement a dedicated "User Management" page.
- Enable users to update their personal profile (avatar, password).
- Enable administrators to manage all system users (roles, status).
- Improve header and sidebar navigation for user-centric actions.

**Non-Goals:**

- Implementing a complex user permission/ACL system beyond roles.
- Implementing a full-blown file upload service (avatars will be stored as URLs/base64).

## Decisions

**Database Schema Update:**
Add an `avatar` column (TEXT) to the `users` table in the SQLite database.

**User Management Page Structure:**
- **Tab 1: My Profile**: A form for the currently logged-in user to update their username (if allowed), password, and upload an avatar.
- **Tab 2: All Users (Admin Only)**: A table view for administrators to see all users, edit their roles, and freeze/unfreeze accounts.

**Avatar Storage:**
For this initial implementation, avatars will be stored as Base64 encoded strings directly in the `avatar` column to avoid the complexity of a file storage service.

**Navigation:**
- **Sidebar**: Add "用户管理" (User Management) link.
- **Header Dropdown**: Change "修改密码" to "用户管理" (User Management), linking directly to the new page.

## Risks / Trade-offs

- [Risk] Large Base64 strings in database: Storing large images as Base64 in SQLite can increase database size significantly. → [Mitigation] Implement size limits on avatar uploads in the frontend and backend.
- [Risk] Complexity of the "All Users" table: Managing many users might become difficult in a single table. → [Mitigation] Implement pagination/filtering if the user base grows.
