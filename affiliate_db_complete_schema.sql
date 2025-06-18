-- Complete Database Schema for affiliate_db
-- Generated on: 2025-06-16T18:13:17.368Z
-- Database: affiliate_db

-- CREATE TABLE statements

CREATE TABLE accounts (id INTEGER NOT NULL DEFAULT nextval('accounts_id_seq'::regclass), user_id INTEGER NOT NULL, type VARCHAR(10), balance NUMERIC(12,2) DEFAULT 0, frozen NUMERIC(12,2) DEFAULT 0, cap NUMERIC(12,2), is_active BOOLEAN DEFAULT true, deposit NUMERIC(10,2) DEFAULT 0, withdrawal NUMERIC(10,2) DEFAULT 0);

CREATE TABLE admin_notifications (id INTEGER NOT NULL DEFAULT nextval('admin_notifications_id_seq'::regclass), user_id INTEGER, type VARCHAR(50) NOT NULL, message TEXT NOT NULL, is_read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE commission_logs (id INTEGER NOT NULL DEFAULT nextval('commission_logs_id_seq'::regclass), user_id INTEGER NOT NULL, source_user_id INTEGER, source_action_id INTEGER, account_type VARCHAR(10), commission_amount NUMERIC(12,2) NOT NULL, commission_type VARCHAR(500) NOT NULL, description TEXT, created_at TIMESTAMP DEFAULT now(), reference_id VARCHAR(255), drive_session_id INTEGER);

CREATE TABLE deposits (id INTEGER NOT NULL DEFAULT nextval('deposits_id_seq'::regclass), user_id INTEGER NOT NULL, amount NUMERIC(12,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING'::character varying, txn_hash VARCHAR(100), description TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE drive_configurations (id INTEGER NOT NULL DEFAULT nextval('drive_configurations_id_seq'::regclass), name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT true, created_by_admin_id INTEGER, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), tasks_required INTEGER NOT NULL, balance_filter_enabled BOOLEAN DEFAULT true, tier_quantity_enabled BOOLEAN DEFAULT true, min_balance_percentage NUMERIC(5,2) DEFAULT 75.00, max_balance_percentage NUMERIC(5,2) DEFAULT 99.00, is_auto_generated BOOLEAN DEFAULT false, associated_user_id INTEGER, is_tier_based BOOLEAN DEFAULT false);

CREATE TABLE drive_orders (id INTEGER NOT NULL DEFAULT nextval('drive_orders_id_seq1'::regclass), session_id INTEGER NOT NULL, task_set_product_id INTEGER NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'pending'::character varying, created_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ);

CREATE TABLE drive_sessions (id INTEGER NOT NULL DEFAULT nextval('drive_sessions_id_seq'::regclass), user_id INTEGER NOT NULL, product_combo_id INTEGER, start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, end_time TIMESTAMP, status VARCHAR(500) DEFAULT 'active'::character varying, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, drive_type VARCHAR(50) DEFAULT 'first'::character varying, tasks_completed INTEGER DEFAULT 0, tasks_required INTEGER, started_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ, session_uuid UUID, last_product_id INTEGER, last_combo_id VARCHAR(100), combo_progress JSONB, starting_balance NUMERIC(12,2), commission_earned NUMERIC(12,2) DEFAULT 0, drive_tasks JSONB, drive_configuration_id INTEGER, current_task_set_id INTEGER, current_task_set_product_id INTEGER, current_user_active_drive_item_id INTEGER, notes TEXT, ended_at TIMESTAMP);

CREATE TABLE drive_task_set_products (id INTEGER NOT NULL DEFAULT nextval('drive_task_set_products_id_seq'::regclass), task_set_id INTEGER NOT NULL, product_id INTEGER NOT NULL, order_in_set INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE drive_task_sets (id INTEGER NOT NULL DEFAULT nextval('drive_task_sets_id_seq'::regclass), drive_configuration_id INTEGER NOT NULL, order_in_drive INTEGER NOT NULL, name VARCHAR(500), is_combo BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ);

CREATE TABLE drives (id INTEGER NOT NULL DEFAULT nextval('drives_id_seq'::regclass), user_id INTEGER NOT NULL, product_id INTEGER NOT NULL, commission NUMERIC(12,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'::character varying, created_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ);

CREATE TABLE general_notification_reads (id INTEGER NOT NULL DEFAULT nextval('general_notification_reads_id_seq'::regclass), general_notification_id INTEGER NOT NULL, user_id INTEGER NOT NULL, read_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE general_notifications (id INTEGER NOT NULL DEFAULT nextval('general_notifications_id_seq'::regclass), category_id INTEGER NOT NULL, title VARCHAR(200) NOT NULL, message TEXT NOT NULL, image_url VARCHAR(500), is_active BOOLEAN DEFAULT true, priority INTEGER DEFAULT 1, start_date TIMESTAMPTZ DEFAULT now(), end_date TIMESTAMPTZ, created_by INTEGER, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE membership_tiers (id INTEGER NOT NULL DEFAULT nextval('membership_tiers_id_seq'::regclass), tier_name VARCHAR(50) NOT NULL, price_usd NUMERIC(10,2) NOT NULL, commission_per_data_percent NUMERIC(5,2) NOT NULL, commission_merge_data_percent NUMERIC(5,2) NOT NULL, data_per_set_limit INTEGER NOT NULL, sets_per_day_limit INTEGER NOT NULL, withdrawal_limit_usd NUMERIC(12,2), max_daily_withdrawals INTEGER NOT NULL, handling_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE notification_categories (id INTEGER NOT NULL DEFAULT nextval('notification_categories_id_seq'::regclass), name VARCHAR(100) NOT NULL, color_code VARCHAR(7) NOT NULL, icon VARCHAR(50), description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), color VARCHAR(7) DEFAULT '#007bff'::character varying);

CREATE TABLE notifications (id INTEGER NOT NULL DEFAULT nextval('notifications_id_seq'::regclass), user_id INTEGER, message TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), is_read BOOLEAN DEFAULT false, category_id INTEGER NOT NULL, title VARCHAR(200), image_url VARCHAR(500), priority INTEGER DEFAULT 1, updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE old_drive_configuration_items (id INTEGER NOT NULL DEFAULT nextval('drive_configuration_items_id_seq'::regclass), drive_configuration_id INTEGER NOT NULL, product_id INTEGER NOT NULL, order_in_drive INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE old_drive_orders (id INTEGER NOT NULL DEFAULT nextval('drive_orders_id_seq'::regclass), session_id INTEGER NOT NULL, product_id INTEGER NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'pending'::character varying, tasks_required INTEGER NOT NULL, order_in_drive INTEGER);

CREATE TABLE product_combos (id INTEGER NOT NULL DEFAULT nextval('product_combos_id_seq'::regclass), product_ids ARRAY NOT NULL, combo_price NUMERIC(10,2) NOT NULL, combo_commission_rate NUMERIC(5,4) NOT NULL, min_balance_required NUMERIC(10,2) DEFAULT 0, min_tier VARCHAR(10) DEFAULT 'bronze'::character varying, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT now());

CREATE TABLE products (id INTEGER NOT NULL DEFAULT nextval('products_id_seq'::regclass), name VARCHAR(500) NOT NULL, price NUMERIC(10,2) NOT NULL, created_at TIMESTAMP DEFAULT now(), description TEXT, image_url VARCHAR(255), is_active BOOLEAN DEFAULT true, status VARCHAR(20) DEFAULT 'active'::character varying, is_combo_only BOOLEAN DEFAULT false);

CREATE TABLE support_messages (id INTEGER NOT NULL DEFAULT nextval('support_messages_id_seq'::regclass), sender_id INTEGER NOT NULL, sender_role VARCHAR(10) NOT NULL, recipient_id INTEGER, subject VARCHAR(255), message TEXT NOT NULL, thread_id INTEGER, is_read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE tier_quantity_configs (id INTEGER NOT NULL DEFAULT nextval('tier_quantity_configs_id_seq'::regclass), tier_name VARCHAR(50) NOT NULL, quantity_limit INTEGER NOT NULL DEFAULT 40, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE user_active_drive_items (id INTEGER NOT NULL DEFAULT nextval('user_active_drive_items_id_seq'::regclass), user_id INTEGER NOT NULL, drive_session_id INTEGER NOT NULL, product_id_1 INTEGER NOT NULL, product_id_2 INTEGER, product_id_3 INTEGER, order_in_drive INTEGER NOT NULL, user_status VARCHAR(10) NOT NULL DEFAULT 'PENDING'::character varying, task_type VARCHAR(50) DEFAULT 'order'::character varying, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, current_product_slot_processed INTEGER NOT NULL DEFAULT 0, drive_task_set_id_override INTEGER);

CREATE TABLE user_drive_configurations (id INTEGER NOT NULL DEFAULT nextval('user_drive_configurations_id_seq'::regclass), user_id INTEGER NOT NULL, drive_configuration_id INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE user_drive_progress (id INTEGER NOT NULL DEFAULT nextval('user_drive_progress_id_seq'::regclass), user_id INTEGER NOT NULL, date DATE NOT NULL, drives_completed INTEGER DEFAULT 0, is_working_day BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now());

CREATE TABLE user_working_days (id INTEGER NOT NULL DEFAULT nextval('user_working_days_id_seq'::regclass), user_id INTEGER NOT NULL, total_working_days INTEGER DEFAULT 0, weekly_progress INTEGER DEFAULT 0, last_reset_date DATE, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now());

CREATE TABLE users (id INTEGER NOT NULL DEFAULT nextval('users_id_seq'::regclass), username VARCHAR(50) NOT NULL, email VARCHAR(100) NOT NULL, password_hash VARCHAR(100) NOT NULL, referral_code VARCHAR(10) NOT NULL, upliner_id INTEGER, tier VARCHAR(50) DEFAULT 'bronze'::character varying, revenue_source VARCHAR(20), created_at TIMESTAMP DEFAULT now(), role VARCHAR(10) DEFAULT 'user'::character varying, withdrawal_password_hash VARCHAR(100), assigned_drive_configuration_id INTEGER, balance NUMERIC(15,2) DEFAULT 0.00);

CREATE TABLE withdrawal_addresses (id INTEGER NOT NULL DEFAULT nextval('withdrawal_addresses_id_seq'::regclass), user_id INTEGER NOT NULL, address_type VARCHAR(10) NOT NULL DEFAULT 'TRC20'::character varying, address VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE withdrawals (id INTEGER NOT NULL DEFAULT nextval('withdrawals_id_seq'::regclass), user_id INTEGER NOT NULL, amount NUMERIC(12,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING'::character varying, address VARCHAR(100) NOT NULL, txn_hash VARCHAR(100), description TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

