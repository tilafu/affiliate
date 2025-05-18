# Data Drive Functionality Overview

This document outlines the data drive functionality, detailing the interaction between the backend and frontend components.

## I. Backend Functionality

The backend manages the core logic of drives, user progress, product assignments, and commission calculations.

### 1. Database Structure (Inferred)

*   **`users`**: Stores user information.
*   **`products`**: Stores details about products available for "driving."
*   **`drive_configurations`** (or similar): Defines different types of drives, number of tasks, commission rates, etc.
*   **`drive_sessions`**: Tracks an active drive instance for a user.
    *   Links to `user_id` and `drive_configuration_id`.
    *   Stores status (active, complete, frozen), start/end times, total tasks, tasks completed, and total commission for that session.
    *   `drive_session_id` is a crucial identifier.
*   **`drive_orders`** (or `drive_tasks`): Represents individual tasks or "orders" within a drive session.
    *   Links to `drive_session_id`, `product_id`.
    *   Stores status (pending, complete), commission for that specific order, and potentially the purchase price.
    *   `drive_order_id` is important here.
*   **`commission_logs`**: Records commission earned by users, possibly linking to `drive_orders` or `drive_sessions`.
*   **`admin_users` / `roles`**: For admin panel access.

### 2. API Endpoints & Controllers

API endpoints are defined in `server/routes/` and their logic is handled by controllers in `server/controllers/`.

#### User-Facing Drive Operations
(Likely in `server/routes/drive.js`, handled by `driveController.js`)

*   **`POST /api/drive/start`**:
    *   Initiates a new drive session.
    *   Creates a `drive_sessions` record and potentially the first `drive_orders` task.
    *   Returns `drive_session_id` and first order details.
*   **`POST /api/drive/getorder`**:
    *   Fetches the next available order/task for the current `drive_session_id`.
    *   Returns product details.
*   **`POST /api/drive/saveorder`**:
    *   Marks an order/task as completed.
    *   Requires `drive_session_id`, `drive_order_id`, `product_id`.
    *   Updates `drive_orders` and `drive_sessions` (progress, commission).
    *   Logs commission.
    *   Returns updated drive status.
*   **`GET /api/drive/status`**:
    *   Checks the status of the user's current/last drive session.
    *   Returns session details (status, progress, commission, current order if active).

#### Admin Panel Drive Operations
(Likely in `server/routes/admin.js`, handled by `adminController.js`)

*   **`GET /api/admin/drives`**:
    *   Controller: `getDrives`
    *   Fetches a list of all users and their summary drive statistics.
*   **`GET /api/admin/drives/:userId/logs`**:
    *   Controller: `getDriveLogs`
    *   Fetches detailed drive history for a specific user.
*   **`POST /api/admin/drives/reset/:userId`**:
    *   Controller: `resetDrive`
    *   Resets a user's drive progress.
*   **`GET /api/admin/drives/:userId`**:
    *   Fetches latest summary drive statistics for a single user (for dynamic admin panel updates).

## II. Frontend Functionality

The frontend handles user interaction, API calls, and data display.

### 1. User-Facing Drive Page (`task.html` & `task.js`)

*   **Initialization (`initializeTaskPage`, `checkDriveStatus`):**
    *   On load, calls `/api/drive/status` to check for an active session and restore state or show "Start Drive" button.
*   **Starting a Drive (`startDriveProcess`, `callStartDriveAPI`):**
    *   Calls `POST /api/drive/start`.
    *   `renderProductCard` displays the first order; UI elements (progress bars, commission) are updated.
*   **Processing an Order (`handlePurchase`):**
    *   Calls `POST /api/drive/saveorder`.
    *   Response updates UI for tasks completed and commission.
*   **Fetching Next Order (`fetchNextOrder`):**
    *   After a successful `saveorder` (if drive not complete), calls `POST /api/drive/getorder`.
    *   New product displayed via `renderProductCard`.
*   **Drive Completion (`displayDriveComplete`):**
    *   When tasks are completed, UI shows a completion message and final commission.
*   **Error/Frozen States (`displayDriveError`, `displayFrozenState`):**
    *   Handles API errors and specific backend states, updating UI.
*   **ID Tracking (`idTracking` object):**
    *   Logs `sessionIdHistory`, `orderIdHistory`, `productIdHistory` for debugging ID consistency.

### 2. Admin Panel - Data Drive Tab (`admin.html`, `admin.js`, `drive-data-enhancement.js`)

*   **Loading Initial Drive Data (`loadDrives` in `admin.js`):**
    *   Calls `GET /api/admin/drives`.
    *   Populates the main admin table with user drive summaries.
*   **Viewing Drive History (`enhancedLoadDriveHistory` in `drive-data-enhancement.js`):**
    *   Triggered by "View History" button.
    *   Calls `GET /api/admin/drives/:userId/logs`.
    *   Response data (individual drive entries) is formatted into an HTML table and displayed in a modal.
    *   **Commission per drive** is shown in this modal.
*   **Resetting a User's Drive (`enhancedResetDrive` in `drive-data-enhancement.js`):**
    *   Triggered by "Reset Drive" button.
    *   After confirmation, calls `POST /api/admin/drives/reset/:userId`.
*   **Dynamic Updates (`enhancedRefreshDriveData`, `setupDriveDataRefresh` in `drive-data-enhancement.js`):**
    *   `enhancedRefreshDriveData(userId)`: Called after actions like reset. Fetches fresh data for one user from `GET /api/admin/drives/:userId` and updates the specific table row.
    *   `enhanceDriveTable`: Adds `data-user-id` and classes to table elements for easier DOM manipulation.
    *   `setupDriveDataRefresh`: Periodically calls `loadDrives` (from `admin.js`) to refresh the entire admin table if the drives tab is active.
*   **Styling and UI Enhancements:**
    *   `addCustomDriveStyles`: Adds CSS for row highlighting and status badges.
    *   `highlightRow`: Provides visual feedback for updated rows.

## III. Data Flow Summary

*   **User Drive:**
    User Action (UI) -> `task.js` -> API Call to Backend -> Backend Controller (DB interaction) -> JSON Response -> `task.js` updates UI.
*   **Admin Panel:**
    Admin Action (UI) -> `drive-data-enhancement.js`/`admin.js` -> API Call to Admin Backend -> Admin Controller (DB interaction) -> JSON Response -> JS updates admin table/modal.

The system uses asynchronous JavaScript (async/await, Promises) for API calls and DOM updates. `localStorage` is used for `auth_token` and `current_drive_session_id` to maintain state.
