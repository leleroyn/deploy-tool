## 1. Frontend: User Header UI

- [x] 1.1 Create a `UserDropdown` component in `web/src/components/` (including click-outside detection)
- [x] 1.2 Integrate `UserDropdown` into `Layout.tsx` (replacing the simple logout button)
- [x] 1.3 Add "Change Password" and "Logout" items with appropriate icons

## 2. Frontend: Password Change Flow

- [x] 2.1 Create a `ChangePasswordModal` component in `web/src/components/` (including validation)
- [x] 2.2 Implement the form with validation (current password, new password, confirm password)
- [x] 2.3 Connect the modal to the API client to submit the password change request

## 3. Backend: Password Update API

- [x] 3.1 Implement a new endpoint `POST /api/auth/change-password` in the server
- [x] 3.2 Implement the logic to validate the current password and update to the new one in the database
- [x] 3.3 Ensure the session remains valid after a password change

## 4. Integration & Verification

- [x] 4.1 Verify the dropdown opens and closes correctly
- [x] 4.2 Verify the password change flow (success and failure cases)
- [x] 4.3 Verify logout functionality via the dropdown
