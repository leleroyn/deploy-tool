## Why

Currently, user management is limited to simple authentication. Users lack the ability to manage their own profiles (like avatars), and there is no centralized interface for administrators to manage all users. Moving profile management to a dedicated page improves usability and scalability.

## What Changes

- **Database Schema Update**: Add an `avatar` field to the `users` table to support profile pictures.
- **User Management Page**: Create a new dedicated page for managing user information, including profile updates and password changes.
- **Header Dropdown Update**: Replace "Change Password" with "User Management" in the user dropdown menu, which will link to the new page.
- **Sidebar Update**: Add a "User Management" link to the side navigation bar for easier access.

## Capabilities

### New Capabilities

- `user-profile-management`: Allows users to manage their own profile information, including avatar and password.
- `user-admin-management`: Provides administrators with a view to manage all system users (roles, freezing, etc.).

### Modified Capabilities

- `session-management`: Updates to handle user profile changes (like password updates) which may affect existing sessions.

## Impact

- **Frontend**: New `UserManagementPage` component, updated `UserDropdown`, updated `Layout` (sidebar), and updated `appStore` to manage user profile data.
- **Backend**: Updated `users` table schema and new API endpoints for profile and user management.
- **Database**: Schema migration to add the `avatar` column.
