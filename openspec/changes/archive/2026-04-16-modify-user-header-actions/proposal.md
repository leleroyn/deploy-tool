## Why

The current user area in the header provides no way for users to manage their accounts or securely exit their session. Adding "Change Password" and "Logout" functionality is essential for user security and usability.

## What Changes

- **User Dropdown Menu**: A new dropdown menu will be added to the user avatar/name area in the top-right corner.
- **Change Password Feature**: A new option in the dropdown that opens a modal to allow users to update their password.
- **Logout Feature**: A new option in the dropdown that triggers the existing logout process and redirects the user to the login page.

## Capabilities

### New Capabilities

- `user-header-ui`: Provides a dropdown menu in the header for quick access to user-related actions.
- `password-change-flow`: Handles the UI and interaction for updating the user's password.

### Modified Capabilities

- `session-management`: UI integration to trigger session termination via the logout action.

## Impact

- **Frontend**: Header component, User menu component, Password change modal, API client for password updates.
- **Backend**: Password update endpoint (if required), existing logout endpoint.
