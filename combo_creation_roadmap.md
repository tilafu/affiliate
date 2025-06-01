git# Roadmap: Enhanced Combo Product Creation and Real-time User Progress Viewing

## 1. Introduction and Goals

This document outlines the development plan for a new feature enabling administrators to dynamically create "combo products" (specialized `drive_task_sets`) and insert them into a specific user's active drive sequence. This process will be enhanced by providing administrators with a real-time view of the user's current progress within their assigned drive, allowing for strategic placement of these new combo task sets.

The primary goals are:
*   To provide flexibility in customizing drive paths for individual users by adding new combo offers.
*   To empower administrators with real-time data to make informed decisions about when and where to introduce these combos.
*   To streamline the process of creating and assigning these user-specific combo task sets.

## 2. Key Assumptions

*   A "combo product" or "combo task set" is a `drive_task_set` where `is_combo` is true, allowing it to be associated with multiple products via the `drive_task_set_products` table.
*   The system utilizes a table (e.g., `user_drive_progress` or similar, potentially derived from `user_active_drive_items` or `user_drive_configs`) to track an individual user's progress through their assigned drive configuration, including the sequence of task sets and their completion status. This table must be capable of handling user-specific ordering or additions.
*   `fetchWithAuth` is available and configured for making authenticated API calls from the frontend.
*   Bootstrap 5 is used for modal dialogs and UI components.

## 3. Phase 1: Backend - Real-time User Drive Progress API

**Objective:** Develop an API endpoint to provide real-time information about a user's current position and progress within their assigned drive.

**Tasks:**

1.  **Define User Progress Metrics:**
    *   Identify key data points:
        *   User ID.
        *   Currently assigned `drive_configuration_id` and name.
        *   List of all task sets in the user's specific sequence (including `drive_task_set_id`, name, `order_in_drive`).
        *   The ID and name of the user's *current* active `drive_task_set`.
        *   The user's completion status for each task set in their sequence.
        *   Total number of task sets in the user's sequence.
2.  **Database Schema Review/Refinement:**
    *   Ensure the `user_drive_progress` table (or its equivalent, like `user_active_drive_items` possibly augmented with ordering) can store and efficiently query the user-specific sequence of task sets and their completion status. This table is critical for allowing user-specific drive paths.
3.  **Develop API Endpoint:**
    *   Create a new GET endpoint: `GET /api/admin/users/{userId}/drive-progress`
    *   **Request:** Path parameter `userId`.
    *   **Response:** JSON object containing the defined progress metrics.
        ```json
        {
          "success": true,
          "userId": "user123",
          "driveConfigurationId": "config_abc",
          "driveConfigurationName": "Standard User Drive",
          "currentTaskSet": {
            "id": "task_set_efg",
            "name": "Introduction Video",
            "orderInDrive": 2
          },
          "totalTaskSets": 10,
          "taskSets": [
            { "id": "task_set_xyz", "name": "Welcome Pack", "orderInDrive": 1, "status": "completed" },
            { "id": "task_set_efg", "name": "Introduction Video", "orderInDrive": 2, "status": "active" },
            { "id": "task_set_hij", "name": "Product Tutorial 1", "orderInDrive": 3, "status": "pending" }
            // ... more task sets
          ]
        }
        ```
4.  **Implement Backend Logic:**
    *   In `adminDriveController.js` (or a new dedicated controller), implement the function to:
        *   Fetch the user's assigned drive configuration.
        *   Retrieve the specific sequence and status of task sets for that user from `user_drive_progress` (or equivalent).
        *   Determine the "current" task set based on completion status.
        *   Format and return the response.

## 4. Phase 2: Frontend - Displaying Real-time User Progress

**Objective:** Integrate the user drive progress API into the admin interface to provide administrators with real-time visibility.

**Tasks:**

1.  **UI Location for Progress Display:**
    *   The primary location will be within the new "Create & Assign Custom Combo" modal (detailed in Phase 4).
    *   Consider also displaying a summary in the `showAssignDriveConfigModal` when a user is selected, before opening the combo creation modal.
2.  **Develop UI Component for Progress:**
    *   Create a clear and concise display (e.g., "User: [Username] - Drive: [Drive Name] - Progress: Task [Current Task Order] of [Total Tasks] ('[Current Task Name]')").
    *   Optionally, list upcoming tasks.
3.  **API Integration:**
    *   In `admin-drives.js`, when the "Create & Assign Custom Combo" flow is initiated for a user:
        *   Call the `GET /api/admin/users/{userId}/drive-progress` endpoint.
        *   Update the UI component with the fetched data.
        *   Implement polling (e.g., every 15-30 seconds) or a manual refresh button while the combo creation modal is open to keep progress data reasonably current.

## 5. Phase 3: Backend - Dynamic Combo Task Set Insertion API

**Objective:** Create an API endpoint that allows an administrator to define a new combo task set and insert it into a specific user's drive sequence at a designated position.

**Tasks:**

1.  **Design API Endpoint:**
    *   Create a new POST endpoint: `POST /api/admin/users/{userId}/drive/add-combo`
    *   **Request Body:**
        ```json
        {
          "comboName": "Special Mid-Drive Offer",
          "comboDescription": "A limited-time bundle for active users.",
          "productIds": ["prod_1", "prod_2", "prod_3"], // Array of product IDs for the combo
          "insertAfterTaskSetId": "task_set_abc", // ID of the task set after which this combo should be inserted. Null if inserting at the beginning.
          // OR
          "insertAtOrder": 3 // Specify an absolute order. The system will need to re-sequence subsequent tasks.
        }
        ```
        *(Need to decide on `insertAfterTaskSetId` vs `insertAtOrder` or support both. `insertAtOrder` might be more robust if task sets can be deleted).*
2.  **Implement Backend Logic:**
    *   In `adminDriveController.js` (or a related controller):
        *   **Validation:** Ensure `userId`, `comboName`, `productIds`, and insertion point are valid.
        *   **Create `drive_task_set`:**
            *   Insert a new record into `drive_task_sets` with `name = comboName`, `description = comboDescription`, `is_combo = true`. Get the new `drive_task_set_id`.
        *   **Create `drive_task_set_products`:**
            *   For each `productId` in `productIds`, insert a record into `drive_task_set_products` linking it to the new `drive_task_set_id`.
        *   **Update User's Drive Sequence (Critical Step):**
            *   This is the most complex part. It involves modifying the user's specific task set sequence, likely stored in `user_drive_progress` or a similar table.
            *   Retrieve the user's current task set sequence.
            *   Determine the correct insertion point based on `insertAfterTaskSetId` or `insertAtOrder`.
            *   Insert the new combo task set into this sequence.
            *   Re-calculate and update the `order_in_drive` (or equivalent sequencing field) for the new task set and all subsequent task sets for *that user only*.
            *   Ensure this operation is atomic (use database transactions).
    *   **Response:** Success message with details of the created combo and its placement, or an error message.

## 6. Phase 4: Frontend - UI for Creating and Inserting Combos

**Objective:** Develop the user interface for administrators to define, view user progress, and insert new combo task sets.

**Tasks:**

1.  **New Button in `showAssignDriveConfigModal`:**
    *   In `public/js/admin-drives.js`, modify the `showAssignDriveConfigModal` function.
    *   After fetching and displaying user details and their currently assigned drive, add a new button: "Create & Assign Custom Combo".
    *   This button will be enabled if a user and their assigned drive are identified.
    *   Clicking this button will trigger a new function, e.g., `showCreateUserComboModal(userId, username, assignedConfigId, assignedConfigName)`.
2.  **Develop `showCreateUserComboModal` Function:**
    *   This function will construct and display a new modal.
    *   **Modal Content:**
        *   **User/Drive Info:** Display user's name and current drive.
        *   **Real-time Progress Display:** Integrate the component from Phase 2 here. Fetch progress on modal load.
        *   **Form Fields for Combo:**
            *   Combo Name (text input, required).
            *   Combo Description (textarea, optional).
            *   Product Selection:
                *   Use a similar interface to `showCreateDriveConfigurationModal` or `showEditDriveConfigurationModal` for selecting multiple products (fetch available products, filter, checkboxes).
                *   Display selected products count.
            *   **Insertion Point:**
                *   Dropdown list populated with "Insert at beginning", "After [Task Set 1 Name]", "After [Task Set 2 Name]", ... (derived from the user's progress data).
                *   Alternatively, an input for "Order in Drive" (requires careful validation against existing orders).
        *   **Submission:** "Create and Insert Combo" button.
3.  **Implement Modal Logic:**
    *   Fetch available products for selection.
    *   Fetch user's drive progress (as per Phase 2) to populate insertion point options and display progress.
    *   On form submission:
        *   Collect all data (combo name, description, selected product IDs, insertion point).
        *   Perform client-side validation.
        *   Call the `POST /api/admin/users/{userId}/drive/add-combo` API (from Phase 3).
        *   Handle success: Show notification, close modal, potentially refresh the view in `showAssignDriveConfigModal` or the main drive configurations list if relevant.
        *   Handle errors: Show notification with error details.

## 7. Phase 5: Database Schema and Data Integrity

**Objective:** Ensure the database schema robustly supports user-specific drive sequences and dynamic modifications.

**Tasks:**

1.  **Review `user_drive_progress` (or equivalent):**
    *   Confirm this table (e.g., `user_drive_progress`, `user_active_drive_items`) can store a user-specific `order_in_drive` for each task set assigned to them.
    *   It should allow for easy re-ordering and insertion of new task sets specific to a user without affecting the base `drive_configuration` or other users.
    *   Consider if a new table like `user_drive_task_sequence` is cleaner if existing tables are not suitable. This table would link `user_id`, `drive_task_set_id`, and `user_specific_order`.
2.  **Data Consistency:**
    *   Implement necessary constraints and backend logic to prevent inconsistent states (e.g., duplicate orders for the same user, orphaned user-specific task sets).
    *   Ensure that when a base `drive_configuration` is unassigned or changed for a user, any user-specific combo additions tied to the old configuration are handled appropriately (e.g., archived, deleted, or flagged).

## 8. Phase 6: Integration, Testing, and Refinement

**Objective:** Ensure the feature is fully integrated, bug-free, and provides a good user experience.

**Tasks:**

1.  **End-to-End Testing:**
    *   Test user progress display accuracy.
    *   Test combo creation with various product selections.
    *   Test insertion at different points in a user's drive (beginning, middle, end).
    *   Verify that re-ordering of subsequent tasks for the user is correct.
    *   Test edge cases (e.g., empty drive, user with no drive assigned, invalid product IDs).
    *   Verify that changes are user-specific and do not affect other users or the base drive configuration.
2.  **UI/UX Review:**
    *   Gather feedback on the clarity and usability of the new modals and progress display.
    *   Refine UI elements, button placement, and informational messages.
3.  **Error Handling:**
    *   Ensure comprehensive error handling on both frontend and backend, with clear messages to the admin.
4.  **Documentation:**
    *   Update any internal documentation regarding drive management and user administration.

## 9. Future Considerations (Optional)

*   **Visual Timeline:** A more visual representation (e.g., a simple timeline or Gantt-like chart) of a user's drive progress and where combos are placed.
*   **Combo Templates:** Allow admins to save frequently used combo definitions as templates.
*   **Conditional Insertion:** More advanced rules for inserting combos (e.g., "insert if user completes task X within Y days").
*   **Editing/Removing User-Specific Combos:** Functionality for admins to later edit or remove a combo that was specifically added to a user's drive.

This roadmap provides a structured approach to developing this significant enhancement. Each phase builds upon the previous, ensuring a methodical implementation.
