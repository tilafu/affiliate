-- SQL Script to create and populate the membership_tiers table

-- Drop the table if it exists (optional, for development; use with caution)
-- DROP TABLE IF EXISTS membership_tiers;

CREATE TABLE IF NOT EXISTS membership_tiers (
    id SERIAL PRIMARY KEY,
    tier_name VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'Bronze', 'Silver', 'Gold', 'Platinum'
    price_usd DECIMAL(10, 2) NOT NULL,
    commission_per_data_percent DECIMAL(5, 2) NOT NULL,
    commission_merge_data_percent DECIMAL(5, 2) NOT NULL,
    data_per_set_limit INTEGER NOT NULL, -- Corresponds to "Limited to X data per set"
    sets_per_day_limit INTEGER NOT NULL, -- Corresponds to "X sets of data everyday"
    withdrawal_limit_usd DECIMAL(12, 2) NULL, -- NULL for unlimited
    max_daily_withdrawals INTEGER NOT NULL, -- Based on "X times of withdrawal"
    handling_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN membership_tiers.data_per_set_limit IS 'Corresponds to "Limited to X data per set" from memberships.html; could be interpreted as tasks per drive/set.';
COMMENT ON COLUMN membership_tiers.sets_per_day_limit IS 'Corresponds to "X sets of data everyday" from memberships.html; could be interpreted as drives/sets per day.';
COMMENT ON COLUMN membership_tiers.withdrawal_limit_usd IS 'NULL indicates an unlimited withdrawal limit.';
COMMENT ON COLUMN membership_tiers.max_daily_withdrawals IS 'Interpreted from "X times of withdrawal" in memberships.html, assuming per day.';

-- Populate the table with data from memberships.html
-- Ensure these tier_name values EXACTLY match what is stored/expected in the users table (e.g., users.tier)
-- and any other parts of the application that reference tier names. Case-sensitivity matters.

INSERT INTO membership_tiers (
    tier_name, price_usd, commission_per_data_percent, commission_merge_data_percent,
    data_per_set_limit, sets_per_day_limit, withdrawal_limit_usd, max_daily_withdrawals, handling_fee_percent
) VALUES
('Bronze', 100.00, 0.50, 1.50, 40, 2, 5000.00, 1, 0.00),
('Silver', 1000.00, 1.00, 3.00, 40, 2, 20000.00, 2, 0.00),
('Gold', 3000.00, 1.50, 4.50, 45, 2, 50000.00, 2, 0.00),
('Platinum', 5000.00, 2.00, 6.00, 45, 2, NULL, 3, 0.00) -- NULL for Platinum's unlimited withdrawal limit
ON CONFLICT (tier_name) DO NOTHING; -- Prevents errors if script is run multiple times and these tiers already exist.

/*
-- Next Steps & Considerations:

1.  **User Table Integration:**
    *   Ideally, your `users` table should have a `membership_tier_id INT REFERENCES membership_tiers(id)` column.
    *   If your `users` table currently stores tier as a string (e.g., `users.tier VARCHAR(50)`), ensure the values
        in `users.tier` (like 'Bronze', 'Gold') EXACTLY match the `tier_name` in this `membership_tiers` table.

2.  **Backend Logic Update:**
    *   Modify your backend services (especially in `adminDriveController.js` and related services like `tierCommissionService.js`)
        to query this `membership_tiers` table to get authoritative tier properties (commissions, limits, etc.).

3.  **Addressing "Tier quantity configuration not found" Error:**
    *   The error indicates your system uses a table (likely named `tier_quantity_configurations`) to determine drive/task quantities per tier.
    *   The `data_per_set_limit` and `sets_per_day_limit` columns in the new `membership_tiers` table are derived from `memberships.html`
        and might serve the purpose of the `tier_quantity_configurations` table.
    *   **Option A (Use this new table):** Refactor the backend (e.g., `assignTierBasedDriveToUser` in `adminDriveController.js`)
        to use `membership_tiers.data_per_set_limit` and `membership_tiers.sets_per_day_limit`.
    *   **Option B (Populate existing table):** If you must keep `tier_quantity_configurations`, ensure it's populated correctly.
        The `tier_name` in `tier_quantity_configurations` must match `users.tier`. Example:
        ```sql
        -- Assuming tier_quantity_configurations has columns: tier_name, max_items_per_drive, max_drives_per_day
        -- Ensure these tier_names match your users.tier values and membership_tiers.tier_name values.
        INSERT INTO tier_quantity_configurations (tier_name, max_items_per_drive, max_drives_per_day) VALUES
        ('Bronze', 40, 2),
        ('Silver', 40, 2),
        ('Gold', 45, 2),
        ('Platinum', 45, 2)
        ON CONFLICT (tier_name) DO NOTHING;
        ```
    *   The key is consistency in `tier_name` across `users`, `membership_tiers`, and `tier_quantity_configurations` if it's used.

4.  **Database Schema Review:**
    *   Check your `schema.sql` or `init.sql` for the exact structure of `users` and `tier_quantity_configurations`
        to ensure compatibility and correct foreign key relationships or string matching.
*/
