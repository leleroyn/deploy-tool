## ADDED Requirements

### Requirement: User Action Dropdown
The system SHALL provide a dropdown menu in the top-right header area when the user avatar or name is clicked.

#### Scenario: Opening the menu
- **WHEN** the user clicks on their avatar or name in the header
- **THEN** a dropdown menu SHALL appear below the user area.

#### Scenario: Closing the menu
- **WHEN** the user clicks anywhere outside the dropdown menu
- **THEN** the dropdown menu SHALL close.

### Requirement: Change Password Action
The dropdown menu SHALL include a "Change Password" (修改密码) option.

#### Scenario: Clicking Change Password
- **WHEN** the user selects "Change Password" from the dropdown
- **THEN** the system SHALL trigger a callback to open the password change interface (e.g., a modal).

### Requirement: Logout Action
The dropdown menu SHALL include a "Logout" (注销) option.

#### Scenario: Clicking Logout
- **WHEN** the user selects "Logout" from the dropdown
- **THEN** the system SHALL execute the logout process and redirect the user to the login page.
