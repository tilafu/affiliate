# Database Field Mismatch Analysis Report
# Generated: 2025-06-16

## CRITICAL ERRORS FOUND

### 1. users table field mismatches:

**❌ PROBLEM**: Code tries to access `user_tier_id` but table has `tier`
- **File**: `server/controllers/adminDriveController.js` (lines 1519, 1576)
- **Database has**: `tier` (VARCHAR(50))
- **Code tries to access**: `user_tier_id` (doesn't exist)
- **Query**: `SELECT id, user_tier_id FROM users WHERE id = $1`

**❌ PROBLEM**: Code tries to access `mobile_number` but table doesn't have this field
- **File**: `server/controllers/user.js` (line 17)
- **Database has**: No `mobile_number` column in users table
- **Code tries to access**: `mobile_number`
- **Query**: `SELECT id, username, email, referral_code, tier, mobile_number, created_at FROM users WHERE id = $1`

### 2. tier_quantity_configs table field mismatches:

**❌ PROBLEM**: Code tries to access `tier_id` but table has `tier_name`
- **File**: `server/controllers/adminDriveController.js` (lines 1229, 1275, 1529, 1587)
- **Database has**: `tier_name` (VARCHAR(50))
- **Code tries to access**: `tier_id` (doesn't exist)
- **Query**: `SELECT min_price_single, max_price_single FROM tier_quantity_configs WHERE tier_id = $1`

**❌ PROBLEM**: Code tries to access `min_price_single`, `max_price_single` but table doesn't have these fields
- **File**: `server/controllers/adminDriveController.js` (lines 1529, 1587)
- **Database has**: `quantity_limit`
- **Code tries to access**: `min_price_single`, `max_price_single` (don't exist)

### 3. Referenced table that doesn't exist:

**❌ PROBLEM**: Code references `user_tiers` table that doesn't exist
- **File**: `server/controllers/adminDriveController.js` (line 1229)
- **Database has**: No `user_tiers` table
- **Code tries to JOIN**: `user_tiers ut ON tqc.tier_id = ut.id`

### 4. Missing column in drive_sessions:

**❌ PROBLEM**: Code references `frozen_amount_needed` in schema extraction but this column doesn't appear to be properly defined
- **Database extracted**: `frozen_amount_needed - numeric NULL` (line 14 in drive_sessions)
- **Potential issue**: Column appears in extraction but may be missing constraints or proper definition

## DETAILED ANALYSIS

### users table actual structure:
```sql
id - integer PRIMARY KEY
username - varchar(50) NOT NULL UNIQUE  
email - varchar(100) NOT NULL UNIQUE
password_hash - varchar(100) NOT NULL
referral_code - varchar(10) NOT NULL UNIQUE
upliner_id - integer (FK to users.id)
tier - varchar(50) DEFAULT 'bronze'
revenue_source - varchar(20)
created_at - timestamp DEFAULT now()
role - varchar(10) DEFAULT 'user'
withdrawal_password_hash - varchar(100)
assigned_drive_configuration_id - integer
balance - numeric(15,2) DEFAULT 0.00
```

### tier_quantity_configs table actual structure:
```sql
id - integer PRIMARY KEY
tier_name - varchar(50) NOT NULL UNIQUE
quantity_limit - integer NOT NULL DEFAULT 40
is_active - boolean DEFAULT true
created_at - timestamp DEFAULT CURRENT_TIMESTAMP
updated_at - timestamp DEFAULT CURRENT_TIMESTAMP
```

## FIXES REQUIRED

### Fix 1: Replace user_tier_id with tier in adminDriveController.js
- Lines 1519, 1523, 1576, 1580
- Change: `user_tier_id` → `tier`
- Change logic to use tier name instead of tier ID

### Fix 2: Remove mobile_number from user queries
- File: `server/controllers/user.js` (line 17)
- Either add mobile_number column to users table OR remove from queries

### Fix 3: Fix tier_quantity_configs queries
- Lines 1229, 1275, 1529, 1587 in adminDriveController.js
- Change: `tier_id` → `tier_name` 
- Remove references to non-existent columns: `min_price_single`, `max_price_single`
- Remove JOIN to non-existent `user_tiers` table

### Fix 4: Add missing database columns if needed
- Consider adding `mobile_number` to users table
- Consider adding pricing columns to tier_quantity_configs table
- Consider creating user_tiers table if the tier system needs it

## IMPACT ASSESSMENT

**HIGH IMPACT**: These errors will cause:
1. Database query failures (column does not exist)
2. Application crashes when accessing user tier information
3. Admin panel functionality failures
4. Profile update failures for mobile number
5. Drive configuration issues

## RECOMMENDED ACTION

Run the fix script immediately to resolve these critical database field mismatches.
