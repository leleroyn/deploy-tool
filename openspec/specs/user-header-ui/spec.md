# user-header-ui Specification

## Purpose
Display user identity in the header with quick access to user management and logout.

## Requirements
### Requirement: User Action Dropdown
The system SHALL provide a dropdown menu in the top-right header area when the user avatar or name is clicked.

#### Scenario: Opening the menu
- **WHEN** the user clicks on their avatar or name in the header
- **THEN** a dropdown menu SHALL appear below the user area.

#### Scenario: Closing the menu
- **WHEN** the user clicks anywhere outside the dropdown menu
- **THEN** the dropdown menu SHALL close.

### Requirement: User Avatar Display
The header SHALL display the user's avatar in the dropdown trigger area.

#### Scenario: Displaying user avatar
- **WHEN** the header renders the user area
- **THEN** the system SHALL display the user's avatar image if available.

### Requirement: User Management Navigation
The sidebar SHALL include a "User Management" (用户管理) option.

#### Scenario: Accessing user management
- **WHEN** the user clicks on "User Management" in the sidebar
- **THEN** the system SHALL navigate to the User Management page.

### Requirement: Logout Action
The dropdown menu SHALL include a "Logout" (注销) option.

#### Scenario: Clicking Logout
- **WHEN** the user selects "Logout" from the dropdown
- **THEN** the system SHALL execute the logout process and redirect the user to the login page.

