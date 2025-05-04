# Data Drive Backend Implementation Plan

**Goal:** Implement the server-side logic for users to start, participate in, and complete Data Drives, including handling product interactions, commissions, balance updates, and necessary checks/limits, based on PRD/problem statement and mimicking `task.html` flow where appropriate.

**Database Schema Considerations:**

A new table `drive_sessions` is likely needed:

*   `id` (Primary Key, SERIAL or UUID)
*   `user_id` (INTEGER, Foreign Key to `users.id`)
*   `drive_type` (VARCHAR, e.g., 'first', 'second') - *Determination logic TBD.*
*   `status` (VARCHAR, default 'active', e.g., 'active', 'completed', 'frozen', 'pending_reset')
*   `tasks_completed` (INTEGER, default 0)
*   `tasks_required` (INTEGER) - *Set based on user's tier at start.*
*   `started_at` (TIMESTAMPTZ, default NOW())
*   `completed_at` (TIMESTAMPTZ, nullable)
*   `session_uuid` (UUID, unique) - *Optional, for frontend reference.*
*   `frozen_amount_needed` (DECIMAL, nullable) - *For frozen balance state.*
*   `last_product_id` (INTEGER, nullable) - *Optional, track last product shown.*
*   `last_combo_id` (VARCHAR/UUID, nullable) - *Optional, track last combo shown.*
*   `combo_progress` (JSONB, nullable) - *Optional, track completed items within a combo.*

**Controller Implementation (`server/controllers/driveController.js`):**

1.  **`startDrive` (`POST /api/drive/start`)**
    *   **Input:** `req.user.id`.
    *   **Logic:**
        *   Fetch user's tier and main account balance (`getUserDriveInfo`).
        *   Determine intended drive type (e.g., based on balance: >= $100 -> second, >= $50 -> first). *Needs clarification/frontend input?*
        *   **Check Eligibility:**
            *   Query `drive_sessions` for active sessions or sessions needing reset for this user today. (Requires `drive_sessions` table & logic).
            *   Check balance against minimum requirement ($50/$100).
            *   Check operating hours (10:00 - 23:00).
        *   **If Eligible:**
            *   Create new `drive_sessions` record (`status='active'`, `tasks_completed=0`, `tasks_required` based on tier, etc.).
            *   Respond: `{ code: 0, info: 'Drive started...' }`.
        *   **If Not Eligible:** Respond: `{ code: 1, info: 'Reason...' }`.

2.  **`getOrder` (`POST /api/drive/getorder`)**
    *   **Input:** `req.user.id`.
    *   **Logic:**
        *   Find the 'active' `drive_session` for the user. Error if none.
        *   If `tasks_completed >= tasks_required`, respond drive complete (`{ code: 2, info: 'Drive complete' }`? TBD).
        *   Fetch user tier/balance.
        *   **Determine Product/Combo:** Implement selection logic (consider tier, balance, avoid repetition if possible).
        *   **If Single Product:**
            *   Fetch product details from `products` table.
            *   Calculate commission.
            *   Generate unique `product_number` (task code).
            *   Respond: `{ success: true, premium_status: 0, product_id, product_name, product_number, ... }`.
        *   **If Combo:**
            *   Fetch details for multiple products.
            *   Calculate totals.
            *   Generate unique `product_number`.
            *   Respond: `{ success: true, premium_status: 1, total_price, total_commission, product_number, products: [...] }`.

3.  **`saveOrder` (`POST /api/drive/saveorder`)** - Single Products
    *   **Input:** `req.user.id`, `product_id`, `order_amount`, `earning_commission`, `product_number`.
    *   **Logic (DB Transaction):**
        *   Find active `drive_session`.
        *   Verify `product_id` details (price, commission rate) against inputs.
        *   Fetch user balance (`accounts` table, `FOR UPDATE`).
        *   **Check Balance:** If `balance < product.price`:
            *   Calculate `frozen_amount_needed`.
            *   Update `drive_sessions` status to 'frozen', set `frozen_amount_needed`.
            *   Respond: `{ code: 1, info: 'Insufficient balance...' }`.
        *   **If Sufficient:**
            *   Calculate `newBalance`.
            *   Update `accounts` balance.
            *   Log commission in `commission_logs`.
            *   Increment `tasks_completed` in `drive_sessions`.
            *   Check if drive complete (`tasks_completed >= tasks_required`), update status if so.
            *   Respond: `{ code: 0, info: 'Order Sent successfully!' }`.

4.  **`saveComboProduct` (`POST /api/drive/savecomboproduct`)** - Combo Items
    *   **Input:** `req.user.id`, `combo_id`, `product_id`, `product_price`, `product_commission`.
    *   **Logic (DB Transaction):**
        *   Similar to `saveOrder` but logs commission type 'data_drive_combo'.
        *   Verify product details.
        *   Fetch balance.
        *   Check balance against `product_price`. Handle insufficient funds ('frozen' state).
        *   If sufficient: update balance, log commission.
        *   Track progress *within* the combo (e.g., update `drive_sessions.combo_progress` JSONB).
        *   Respond: `{ code: 0, info: 'Combo product saved!' }`.

5.  **`saveComboOrder` (`POST /api/drive/savecomboorder`)** - Combo Summary
    *   **Input:** `req.user.id`, `order_amount`, `order_commission`, `product_number`, `total_combos`.
    *   **Logic:**
        *   Find active `drive_session`.
        *   Verify all individual combo products for this task (`product_number`) were processed successfully (check `combo_progress` or related logs).
        *   If verified:
            *   Increment main `drive_sessions.tasks_completed`.
            *   Check for overall drive completion.
            *   Clear combo tracking state (`combo_progress`).
        *   Respond: `{ success: true }` or error.

**Admin Functionality (`adminController.js`):**

*   **`resetDrive` (`POST /api/admin/users/:userId/reset-drive`)**
    *   Find the latest 'completed' or 'pending_reset' `drive_session` for the user.
    *   Update its status or handle it according to reset logic (e.g., allow new session creation).
    *   Log the admin action.
    *   Respond success/failure.

**Frontend (`task.js`):**

*   Ensure `API_BASE_URL` is correctly defined (likely in `main.js`).
*   Handle different response codes/messages from the backend (e.g., insufficient balance, drive complete, reset needed).
*   Update UI elements (balance, task counter) based on backend responses.
*   Manage the display of single vs. combo order popups based on `premium_status`.
