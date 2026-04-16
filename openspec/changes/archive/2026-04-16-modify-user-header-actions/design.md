## Context

The current header provides a simple logout button, but it lacks a centralized user management menu. As the system grows, users will need more options like changing their password without needing to navigate to a full settings page.

## Goals / Non-Goals

**Goals:**

- Implement a clean, modern dropdown menu for user actions in the header.
- Provide a seamless "Change Password" workflow via a modal.
- Maintain visual consistency with the existing "Blue/Dark Blue" theme.

**Non-Goals:**

- Implementing a full "User Profile" page with avatar uploads.
- Implementing advanced security features like 2FA.

## Decisions

**UI Component: Dropdown Menu**
- Use a custom React component for the dropdown to ensure full control over styling and animations.
- The menu will be positioned absolutely relative to the user container.
- Use `lucide-react` icons to match the existing design language.

**Styling**
- **Dropdown**: White background, subtle border (`border-gray-100`), and a soft shadow (`shadow-lg`).
- **Hover State**: Light gray background (`hover:bg-gray-50`) for menu items.
- **Icons**: Use `KeyRound` for password change and `LogOut` for logout.

**Password Change Workflow**
- Use a Modal component (to be implemented/reused) to host the password change form.
- This keeps the user in their current context without a full page reload.

## Risks / Trade-offs

- [Risk] Click-away detection: The menu might not close correctly if click-outside logic is buggy. → [Mitigation] Use a robust implementation or a library like `headlessui` (if already present) or a custom `useEffect` hook with a ref.
- [Risk] Mobile usability: Dropdowns can be tricky on touch devices. → [Mitigation] Ensure the touch target size is sufficient.
