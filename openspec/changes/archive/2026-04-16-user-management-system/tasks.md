## 1. Database & Backend Setup

- [x] 1.1 Update `users` table schema to include `avatar` (TEXT)
- [x] 1.2 Implement API endpoint `PUT /api/users/me` for updating own profile (avatar, password)
- [x] 1.3 Implement API endpoint `GET /api/users` (admin only) for listing all users
- [x] 1.4 Implement API endpoint `PUT /api/users/:id` (admin only) for managing user roles/status

## 2. Frontend: Core Infrastructure

- [x] 2.1 Update `appStore.ts` to include `user` state and `setUser` action
- [x] 2.2 Update `api/http.ts` to include `me`, `updateMe`, `getUsers`, and `updateUser` calls
- [x] 2.3 Update `Layout.tsx` to add "用户管理" (User Management) to the sidebar

## 3. Frontend: User Management Page

- [x] 3.1 Create `UserManagementPage.tsx` component
- [x] 3.2 Implement "My Profile" tab (form for avatar upload and password change)
- [x] 3.3 Implement "All Users" tab (admin-only table with role/status controls)
- [x] 3.4 Integrate avatar preview and upload logic in the profile form

## 4. Frontend: Header & Navigation

- [x] 4.1 Update `UserDropdown.tsx` to replace "修改密码" with "用户管理" and link to the new page
- [x] 4.2 Improve dropdown positioning and styling for better UX

## 5. Verification

- [ ] 5.1 Verify user can update avatar and password via "My Profile"
- [ ] 5.2 Verify admin can manage roles and freeze users via "All Users"
- [ ] 5.3 Verify sidebar and dropdown navigation works correctly

