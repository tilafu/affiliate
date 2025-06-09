# Work Plan: Sequential Product Processing in Data Drive

This document outlines the plan to modify the data drive functionality to process products within a task set (especially combos) sequentially, with balance deductions occurring per individual product.

## I. Backend API Changes (`server/controllers/driveController.js`)

The core idea is to make the backend serve one product at a time, even if it's part of a larger combo item.

1.  **`GET /api/drive/status` (or `POST /api/drive/getorder` if used for initial load/resume)**
    *   **Current:** Returns the entire current task item (which can be a combo).
    *   **New Behavior:**
        *   If the current active task item is a combo, this endpoint (or the one responsible for resuming a drive) should return details for the *first pending product* in that combo/item.
        *   The response needs to indicate its position within the item (e.g., product 1 of 3).
    *   **Response Data Enhancement:**
        *   `drive_status`: (active, frozen, complete, no_session)
        *   `current_product_details`:
            *   `product_id`
            *   `product_name`
            *   `product_image`
            *   `product_price` (individual price)
            *   `order_commission` (individual commission)
        *   `item_id`: Identifier for the overall task item/combo instance (e.g., `user_active_drive_items.id`).
        *   `order_id`: This likely remains the `user_active_drive_items.id`.
        *   `product_slot_in_item`: (e.g., 1, 2, 3) - Indicates which product this is within the item.
        *   `total_products_in_item`: (e.g., 1, 2, or 3) - Total products in this specific item.
        *   `is_last_product_in_item`: (boolean) - True if this is the last product of the current item.

2.  **`POST /api/drive/getorder` (for fetching subsequent products/items)**
    *   **Current:** Fetches the next *task item*.
    *   **New Behavior:**
        *   This endpoint will fetch the *next individual product*.
        *   If the previously completed product was part of an item (combo) and not its last, it fetches the next product *within the same item*.
        *   If the previous product was the last in its item, it fetches the first product of the *next task item*.
        *   If all task items and their sub-products are complete, it signals drive completion.
    *   **Response Data (similar to `/api/drive/status` for product details):**
        *   `code`: 0 for success (product received), 2 for drive complete.
        *   `product_details`: (as above: id, name, image, price, commission)
        *   `item_id`, `order_id`, `product_slot_in_item`, `total_products_in_item`, `is_last_product_in_item`.

3.  **`POST /api/drive/saveorder`**
    *   **Current:** Saves completion of an entire task item, deducts balance for the whole item.
    *   **New Behavior:**
        *   Saves the completion of a *single product* within an item.
        *   Deducts balance for *only that individual product*.
        *   Updates backend tracking for the progress within the item.
    *   **Request Body Enhancement:**
        *   `order_id`: (ID of the `user_active_drive_item`).
        *   `product_id`: (ID of the specific product just purchased).
        *   `item_id`: (ID of the `user_active_drive_item`, effectively).
        *   `product_slot_to_complete`: (e.g., 1, 2, 3) - Identifies which product within the item is being marked as complete.
        *   `order_amount`: Price of *this specific product*.
        *   `earning_commission`: Commission for *this specific product*.
    *   **Backend Logic:**
        *   Verify the product is the correct one to process for the given `item_id` and `product_slot_to_complete`.
        *   Deduct `order_amount` from user balance.
        *   Add `earning_commission` to user earnings/commission balance.
        *   Record the completion of this specific sub-product.
        *   If this was the last sub-product in the item, mark the `user_active_drive_item` as complete.
        *   If this was the last sub-product of the last item in the drive, mark the drive session as complete.
    *   **Response:**
        *   Success/failure of the transaction.
        *   The frontend will subsequently call `/api/drive/getorder` to fetch the next piece of work.

## II. Frontend Changes (`public/js/drive.js`)

1.  **State Management:**
    *   Introduce/utilize variables to track the current product within an item:
        *   `currentItemId`: (e.g., `productData.order_id` or `productData.item_id` from backend)
        *   `currentProductSlotInItem`: (from backend)
        *   `totalProductsInItem`: (from backend)
        *   `isLastProductInCurrentItem`: (from backend)
        *   `currentProductData`: Store the full details of the currently displayed single product.

2.  **`checkDriveStatus()` (and initial load logic):**
    *   Adapt to parse the new response from `/api/drive/status` (or equivalent initial load endpoint).
    *   If an active product is returned, store its details (including slot info) in the frontend state.
    *   Call `renderProductCard()` with the individual product details.

3.  **`fetchNextOrder()` (or the function called after a successful purchase / to get next product):**
    *   This function will call the modified `POST /api/drive/getorder`.
    *   On receiving a new product:
        *   Update frontend state variables (`currentProductSlotInItem`, `totalProductsInItem`, `isLastProductInCurrentItem`, `currentProductData`).
        *   Call `renderProductCard()` with the new product details.
    *   If drive completion is signaled (`data.code === 2`): call `displayDriveComplete()`.
    *   Handle errors appropriately.

4.  **`renderProductCard(productDetails)`:**
    *   Ensure it always renders a single product based on `productDetails` passed to it.
    *   The "Purchase" button should be linked to `handlePurchase`, passing the `productDetails` of the currently displayed product.

5.  **`handlePurchase(productData)`:**
    *   `productData` will now be the details of the *single product* being purchased.
    *   Construct the request for `POST /api/drive/saveorder` using:
        *   `order_id`: `productData.order_id` (or `productData.item_id`)
        *   `product_id`: `productData.product_id`
        *   `item_id`: `productData.item_id`
        *   `product_slot_to_complete`: `productData.product_slot_in_item`
        *   `order_amount`: `productData.product_price`
        *   `earning_commission`: `productData.order_commission`
    *   On successful save (`response.ok && data.code === 0`):
        *   `updateWalletBalance()`.
        *   Call `fetchNextOrder()` to get the next product or drive completion status.
    *   Handle insufficient balance/frozen state (`data.code === 3`) based on the individual product's price.

## III. Database Considerations (`user_active_drive_items` & related tables)

1.  **`user_active_drive_items` Table:**
    *   This table likely stores one row per task item (which could be a single product or a combo) assigned to the user.
    *   It contains `product_id` (which might be a combo ID from the `products` table), `status` (e.g., `pending`, `processing`, `complete`), `order_id` (PK).

2.  **Tracking Sub-Product Progress:**
    *   **Option A (Backend Logic, Minimal DB Change - Preferred Start):**
        *   The `user_active_drive_items.status` would reflect the status of the overall item. It moves to `complete` only when all its sub-products are done.
        *   The backend needs to determine which sub-product is next for a given `user_active_drive_item` if it's a combo.
        *   This can be done by:
            1.  Identifying that `user_active_drive_items.product_id` refers to a combo (e.g., via a flag in the `products` table or by checking a `combo_products` mapping table).
            2.  Querying the `combo_products` table (or similar structure) to get the sequence of products for that combo.
            3.  Tracking the `current_product_index_in_item` or `last_completed_slot` for that `user_active_drive_item.id`. This state could be:
                *   Calculated on-the-fly by seeing which products linked to this `order_id` have been recorded as purchased (e.g., in a `user_purchased_product_log` table if such detailed logging exists and is reliable for this).
                *   Or, if no such detailed log is easily queryable for this purpose, a new column like `current_product_slot_processed` (integer) could be added to `user_active_drive_items`. This column would be updated by `POST /api/drive/saveorder`.
    *   **Option B (Explicit DB Schema Change):**
        *   Add a column like `current_product_slot_processed` (or `current_sub_product_index`) to `user_active_drive_items`. Default to 0 or 1.
        *   When `POST /api/drive/saveorder` processes a product, it increments this counter.
        *   `POST /api/drive/getorder` uses this counter to determine the next sub-product from the combo definition.
        *   The item is marked `complete` when `current_product_slot_processed` equals `total_products_in_item`.

    *Initial Recommendation:* Attempt Option A, potentially by adding a `current_product_slot_processed` (or similar, like `last_completed_slot_index`) column to `user_active_drive_items` as it provides a clear state without overly complex logic for determining the next sub-product.

3.  **`products` Table:**
    *   May need a way to distinguish combo products from single products (e.g., `is_combo` boolean flag, or `product_type` enum).
    *   If a `combo_products` table exists, it would map a combo `product_id` to its constituent real `product_id`s and their sequence. Example `combo_products` table:
        *   `combo_product_id` (FK to `products.id`)
        *   `child_product_id` (FK to `products.id`)
        *   `slot_number` (1, 2, 3)
        *   `price_contribution` (if individual prices are not directly on child products for this combo context) - though simpler if child products have their own standard price.

## IV. Implementation Steps Outline

1.  **Database:**
    *   Decide on and implement the strategy for tracking sub-product progress (e.g., add `current_product_slot_processed` to `user_active_drive_items`).
    *   Ensure `products` table can identify combos and that a `combo_products` (or equivalent) table defines combo contents and sequence.
2.  **Backend (`driveController.js`):**
    *   Refactor `startDrive` if necessary to align with serving the first product of the first item.
    *   Modify `getOrder` (or `/api/drive/status` for resume) to fetch and return single products, including combo slot information.
    *   Modify `saveOrder` to process single product purchases, update balances for single products, and update `current_product_slot_processed`.
3.  **Frontend (`drive.js`):**
    *   Implement frontend state variables.
    *   Update `checkDriveStatus` to handle new API response.
    *   Update `renderProductCard` to display single product details.
    *   Update `handlePurchase` to send single product data and call `fetchNextOrder`.
    *   Implement `fetchNextOrder` to correctly request the next product from the backend.
4.  **Testing:**
    *   Test single product task sets.
    *   Test combo task sets (2-product and 3-product combos).
    *   Test balance deductions at each step.
    *   Test drive completion after all products in all items are processed.
    *   Test frozen state handling with individual product prices.
    *   Test resuming a drive mid-combo.

This plan provides a structured approach to implementing the desired sequential processing.
