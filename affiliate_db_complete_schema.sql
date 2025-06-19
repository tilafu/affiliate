-- Complete Database Schema for affiliate_db
-- Generated on: 2025-06-19
-- Database: affiliate_db
-- Username: postgres

-- Drop existing tables if they exist (in correct order to handle foreign keys)
DROP TABLE IF EXISTS general_notification_reads CASCADE;
DROP TABLE IF EXISTS admin_notifications CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_categories CASCADE;
DROP TABLE IF EXISTS onboarding_responses CASCADE;
DROP TABLE IF EXISTS support_messages CASCADE;
DROP TABLE IF EXISTS withdrawal_addresses CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;
DROP TABLE IF EXISTS deposits CASCADE;
DROP TABLE IF EXISTS commission_logs CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS user_active_drive_items CASCADE;
DROP TABLE IF EXISTS drive_orders CASCADE;
DROP TABLE IF EXISTS drive_task_set_products CASCADE;
DROP TABLE IF EXISTS drive_task_sets CASCADE;
DROP TABLE IF EXISTS drive_sessions CASCADE;
DROP TABLE IF EXISTS drive_configurations CASCADE;
DROP TABLE IF EXISTS user_drive_configurations CASCADE;
DROP TABLE IF EXISTS user_drive_progress CASCADE;
DROP TABLE IF EXISTS user_working_days CASCADE;
DROP TABLE IF EXISTS drives CASCADE;
DROP TABLE IF EXISTS product_combos CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS tier_quantity_configs CASCADE;
DROP TABLE IF EXISTS membership_tiers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS old_drive_configuration_items CASCADE;
DROP TABLE IF EXISTS old_drive_orders CASCADE;

-- Create sequences
CREATE SEQUENCE IF NOT EXISTS users_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS accounts_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS products_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS product_combos_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS membership_tiers_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS tier_quantity_configs_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS drive_configurations_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS drive_task_sets_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS drive_task_set_products_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS drive_sessions_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS user_active_drive_items_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS drive_orders_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS drives_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS commission_logs_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS deposits_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS withdrawals_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS withdrawal_addresses_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS notifications_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS notification_categories_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS general_notifications_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS general_notification_reads_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS admin_notifications_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS support_messages_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS user_drive_configurations_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS user_drive_progress_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS user_working_days_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS onboarding_responses_id_seq START 1;

-- ===========================
-- CORE USER TABLES
-- ===========================

-- Users table - Core user management
CREATE TABLE users (
    id INTEGER PRIMARY KEY DEFAULT nextval('users_id_seq'),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    referral_code VARCHAR(10) UNIQUE NOT NULL,
    upliner_id INTEGER REFERENCES users(id),
    tier VARCHAR(50) DEFAULT 'bronze',
    revenue_source VARCHAR(20),
    role VARCHAR(10) DEFAULT 'user',
    withdrawal_password_hash VARCHAR(255),
    assigned_drive_configuration_id INTEGER,
    balance NUMERIC(15,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone VARCHAR(20),
    country VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User accounts for different balance types
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY DEFAULT nextval('accounts_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'main', -- main, commission, bonus, etc.
    balance NUMERIC(12,2) DEFAULT 0.00,
    frozen NUMERIC(12,2) DEFAULT 0.00,
    cap NUMERIC(12,2),
    is_active BOOLEAN DEFAULT true,
    deposit NUMERIC(12,2) DEFAULT 0.00,
    withdrawal NUMERIC(12,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, type)
);

-- Onboarding responses - New table for user onboarding data
CREATE TABLE onboarding_responses (
    id INTEGER PRIMARY KEY DEFAULT nextval('onboarding_responses_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experience_level VARCHAR(50),
    investment_amount VARCHAR(50),
    risk_tolerance VARCHAR(50),
    learning_preference VARCHAR(50),
    time_commitment VARCHAR(50),
    goal VARCHAR(100),
    additional_info TEXT,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- MEMBERSHIP AND TIERS
-- ===========================

-- Membership tiers configuration
CREATE TABLE membership_tiers (
    id INTEGER PRIMARY KEY DEFAULT nextval('membership_tiers_id_seq'),
    tier_name VARCHAR(50) UNIQUE NOT NULL,
    price_usd NUMERIC(10,2) NOT NULL,
    commission_per_data_percent NUMERIC(5,2) NOT NULL,
    commission_merge_data_percent NUMERIC(5,2) NOT NULL,
    data_per_set_limit INTEGER NOT NULL,
    sets_per_day_limit INTEGER NOT NULL,
    withdrawal_limit_usd NUMERIC(12,2),
    max_daily_withdrawals INTEGER NOT NULL,
    handling_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    min_balance_required NUMERIC(12,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tier quantity configurations
CREATE TABLE tier_quantity_configs (
    id INTEGER PRIMARY KEY DEFAULT nextval('tier_quantity_configs_id_seq'),
    tier_name VARCHAR(50) NOT NULL REFERENCES membership_tiers(tier_name),
    quantity_limit INTEGER NOT NULL DEFAULT 40,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- PRODUCTS AND COMBINATIONS
-- ===========================

-- Products table
CREATE TABLE products (
    id INTEGER PRIMARY KEY DEFAULT nextval('products_id_seq'),
    name VARCHAR(500) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'active',
    is_combo_only BOOLEAN DEFAULT false,
    min_tier VARCHAR(50) DEFAULT 'bronze',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product combinations
CREATE TABLE product_combos (
    id INTEGER PRIMARY KEY DEFAULT nextval('product_combos_id_seq'),
    name VARCHAR(200),
    product_ids INTEGER[] NOT NULL,
    combo_price NUMERIC(10,2) NOT NULL,
    combo_commission_rate NUMERIC(5,4) NOT NULL,
    min_balance_required NUMERIC(10,2) DEFAULT 0,
    min_tier VARCHAR(10) DEFAULT 'bronze',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- DRIVE SYSTEM
-- ===========================

-- Drive configurations
CREATE TABLE drive_configurations (
    id INTEGER PRIMARY KEY DEFAULT nextval('drive_configurations_id_seq'),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by_admin_id INTEGER REFERENCES users(id),
    tasks_required INTEGER NOT NULL,
    balance_filter_enabled BOOLEAN DEFAULT true,
    tier_quantity_enabled BOOLEAN DEFAULT true,
    min_balance_percentage NUMERIC(5,2) DEFAULT 75.00,
    max_balance_percentage NUMERIC(5,2) DEFAULT 99.00,
    is_auto_generated BOOLEAN DEFAULT false,
    associated_user_id INTEGER REFERENCES users(id),
    is_tier_based BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drive task sets
CREATE TABLE drive_task_sets (
    id INTEGER PRIMARY KEY DEFAULT nextval('drive_task_sets_id_seq'),
    drive_configuration_id INTEGER NOT NULL REFERENCES drive_configurations(id) ON DELETE CASCADE,
    order_in_drive INTEGER NOT NULL,
    name VARCHAR(500),
    is_combo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drive task set products
CREATE TABLE drive_task_set_products (
    id INTEGER PRIMARY KEY DEFAULT nextval('drive_task_set_products_id_seq'),
    task_set_id INTEGER NOT NULL REFERENCES drive_task_sets(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    order_in_set INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drive sessions
CREATE TABLE drive_sessions (
    id INTEGER PRIMARY KEY DEFAULT nextval('drive_sessions_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_combo_id INTEGER REFERENCES product_combos(id),
    drive_configuration_id INTEGER REFERENCES drive_configurations(id),
    session_uuid UUID DEFAULT gen_random_uuid(),
    status VARCHAR(50) DEFAULT 'active',
    drive_type VARCHAR(50) DEFAULT 'standard',
    tasks_completed INTEGER DEFAULT 0,
    tasks_required INTEGER,
    starting_balance NUMERIC(12,2),
    commission_earned NUMERIC(12,2) DEFAULT 0,
    current_task_set_id INTEGER REFERENCES drive_task_sets(id),
    current_task_set_product_id INTEGER REFERENCES drive_task_set_products(id),
    current_user_active_drive_item_id INTEGER,
    last_product_id INTEGER REFERENCES products(id),
    last_combo_id VARCHAR(100),
    combo_progress JSONB,
    drive_tasks JSONB,
    notes TEXT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    completed_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User active drive items
CREATE TABLE user_active_drive_items (
    id INTEGER PRIMARY KEY DEFAULT nextval('user_active_drive_items_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drive_session_id INTEGER NOT NULL REFERENCES drive_sessions(id) ON DELETE CASCADE,
    drive_task_set_id_override INTEGER REFERENCES drive_task_sets(id),
    product_id_1 INTEGER NOT NULL REFERENCES products(id),
    product_id_2 INTEGER REFERENCES products(id),
    product_id_3 INTEGER REFERENCES products(id),
    order_in_drive INTEGER NOT NULL,
    user_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    task_type VARCHAR(50) DEFAULT 'order',
    current_product_slot_processed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drive orders
CREATE TABLE drive_orders (
    id INTEGER PRIMARY KEY DEFAULT nextval('drive_orders_id_seq'),
    session_id INTEGER NOT NULL REFERENCES drive_sessions(id) ON DELETE CASCADE,
    task_set_product_id INTEGER NOT NULL REFERENCES drive_task_set_products(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    amount NUMERIC(12,2),
    commission NUMERIC(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Drives (legacy/simplified)
CREATE TABLE drives (
    id INTEGER PRIMARY KEY DEFAULT nextval('drives_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    commission NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- User drive configurations
CREATE TABLE user_drive_configurations (
    id INTEGER PRIMARY KEY DEFAULT nextval('user_drive_configurations_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drive_configuration_id INTEGER NOT NULL REFERENCES drive_configurations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, drive_configuration_id)
);

-- User drive progress tracking
CREATE TABLE user_drive_progress (
    id INTEGER PRIMARY KEY DEFAULT nextval('user_drive_progress_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    drives_completed INTEGER DEFAULT 0,
    is_working_day BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- User working days
CREATE TABLE user_working_days (
    id INTEGER PRIMARY KEY DEFAULT nextval('user_working_days_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_working_days INTEGER DEFAULT 0,
    weekly_progress INTEGER DEFAULT 0,
    last_reset_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ===========================
-- FINANCIAL TRANSACTIONS
-- ===========================

-- Commission logs
CREATE TABLE commission_logs (
    id INTEGER PRIMARY KEY DEFAULT nextval('commission_logs_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_user_id INTEGER REFERENCES users(id),
    source_action_id INTEGER,
    drive_session_id INTEGER REFERENCES drive_sessions(id),
    account_type VARCHAR(20) DEFAULT 'main',
    commission_amount NUMERIC(12,2) NOT NULL,
    commission_type VARCHAR(500) NOT NULL,
    description TEXT,
    reference_id VARCHAR(255),
    transaction_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deposits
CREATE TABLE deposits (
    id INTEGER PRIMARY KEY DEFAULT nextval('deposits_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    txn_hash VARCHAR(255),
    description TEXT,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP
);

-- Withdrawals
CREATE TABLE withdrawals (
    id INTEGER PRIMARY KEY DEFAULT nextval('withdrawals_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    address VARCHAR(255) NOT NULL,
    address_type VARCHAR(20) DEFAULT 'TRC20',
    txn_hash VARCHAR(255),
    description TEXT,
    fee NUMERIC(12,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    processed_at TIMESTAMP
);

-- Withdrawal addresses
CREATE TABLE withdrawal_addresses (
    id INTEGER PRIMARY KEY DEFAULT nextval('withdrawal_addresses_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address_type VARCHAR(20) NOT NULL DEFAULT 'TRC20',
    address VARCHAR(255) NOT NULL,
    label VARCHAR(100),
    is_default BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- NOTIFICATIONS SYSTEM
-- ===========================

-- Notification categories
CREATE TABLE notification_categories (
    id INTEGER PRIMARY KEY DEFAULT nextval('notification_categories_id_seq'),
    name VARCHAR(100) UNIQUE NOT NULL,
    color_code VARCHAR(7) NOT NULL DEFAULT '#007bff',
    color VARCHAR(7) DEFAULT '#007bff',
    icon VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User notifications
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY DEFAULT nextval('notifications_id_seq'),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES notification_categories(id),
    title VARCHAR(200),
    message TEXT NOT NULL,
    image_url VARCHAR(500),
    priority INTEGER DEFAULT 1,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- General notifications (system-wide)
CREATE TABLE general_notifications (
    id INTEGER PRIMARY KEY DEFAULT nextval('general_notifications_id_seq'),
    category_id INTEGER NOT NULL REFERENCES notification_categories(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    target_tier VARCHAR(50),
    target_role VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- General notification reads (tracking who read system notifications)
CREATE TABLE general_notification_reads (
    id INTEGER PRIMARY KEY DEFAULT nextval('general_notification_reads_id_seq'),
    general_notification_id INTEGER NOT NULL REFERENCES general_notifications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(general_notification_id, user_id)
);

-- Admin notifications
CREATE TABLE admin_notifications (
    id INTEGER PRIMARY KEY DEFAULT nextval('admin_notifications_id_seq'),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- SUPPORT SYSTEM
-- ===========================

-- Support messages
CREATE TABLE support_messages (
    id INTEGER PRIMARY KEY DEFAULT nextval('support_messages_id_seq'),
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL DEFAULT 'user',
    recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    thread_id INTEGER REFERENCES support_messages(id),
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'open',
    is_read BOOLEAN DEFAULT false,
    attachments JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- LEGACY TABLES (for compatibility)
-- ===========================

-- Old drive configuration items (deprecated)
CREATE TABLE old_drive_configuration_items (
    id INTEGER PRIMARY KEY,
    drive_configuration_id INTEGER REFERENCES drive_configurations(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    order_in_drive INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Old drive orders (deprecated)
CREATE TABLE old_drive_orders (
    id INTEGER PRIMARY KEY,
    session_id INTEGER REFERENCES drive_sessions(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tasks_required INTEGER NOT NULL,
    order_in_drive INTEGER
);

-- ===========================
-- INDEXES FOR PERFORMANCE
-- ===========================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_upliner_id ON users(upliner_id);
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Account indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_type ON accounts(type);

-- Product indexes
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_created_at ON products(created_at);

-- Drive session indexes
CREATE INDEX idx_drive_sessions_user_id ON drive_sessions(user_id);
CREATE INDEX idx_drive_sessions_status ON drive_sessions(status);
CREATE INDEX idx_drive_sessions_created_at ON drive_sessions(created_at);
CREATE INDEX idx_drive_sessions_uuid ON drive_sessions(session_uuid);

-- User active drive items indexes
CREATE INDEX idx_user_active_drive_items_user_id ON user_active_drive_items(user_id);
CREATE INDEX idx_user_active_drive_items_session_id ON user_active_drive_items(drive_session_id);
CREATE INDEX idx_user_active_drive_items_status ON user_active_drive_items(user_status);

-- Commission logs indexes
CREATE INDEX idx_commission_logs_user_id ON commission_logs(user_id);
CREATE INDEX idx_commission_logs_session_id ON commission_logs(drive_session_id);
CREATE INDEX idx_commission_logs_created_at ON commission_logs(created_at);

-- Notification indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Financial transaction indexes
CREATE INDEX idx_deposits_user_id ON deposits(user_id);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);

-- ===========================
-- INITIAL DATA SETUP
-- ===========================

-- Insert default notification categories
INSERT INTO notification_categories (name, color_code, icon, description) VALUES
('System', '#007bff', 'fas fa-cog', 'System notifications and updates'),
('Drive', '#28a745', 'fas fa-car', 'Data drive related notifications'),
('Commission', '#ffc107', 'fas fa-dollar-sign', 'Commission and earnings notifications'),
('Account', '#17a2b8', 'fas fa-user', 'Account related notifications'),
('Security', '#dc3545', 'fas fa-shield-alt', 'Security and authentication notifications'),
('Withdrawal', '#6f42c1', 'fas fa-money-bill-wave', 'Withdrawal related notifications'),
('Deposit', '#fd7e14', 'fas fa-plus-circle', 'Deposit related notifications'),
('Support', '#20c997', 'fas fa-headset', 'Support and help notifications')
ON CONFLICT (name) DO NOTHING;

-- Insert default membership tiers
INSERT INTO membership_tiers (tier_name, price_usd, commission_per_data_percent, commission_merge_data_percent, data_per_set_limit, sets_per_day_limit, max_daily_withdrawals, handling_fee_percent) VALUES
('bronze', 0.00, 1.00, 0.50, 10, 3, 1, 5.00),
('silver', 100.00, 1.50, 0.75, 15, 5, 2, 4.00),
('gold', 500.00, 2.00, 1.00, 20, 8, 3, 3.00),
('platinum', 1000.00, 2.50, 1.25, 25, 10, 5, 2.00),
('diamond', 5000.00, 3.00, 1.50, 30, 15, 10, 1.00)
ON CONFLICT (tier_name) DO NOTHING;

-- Insert default tier quantity configs
INSERT INTO tier_quantity_configs (tier_name, quantity_limit) VALUES
('bronze', 20),
('silver', 30),
('gold', 40),
('platinum', 50),
('diamond', 60)
ON CONFLICT DO NOTHING;

-- Create admin user (password: admin123)
INSERT INTO users (username, email, password_hash, referral_code, role, tier) VALUES
('admin', 'admin@affiliate.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN001', 'admin', 'diamond')
ON CONFLICT (username) DO NOTHING;

-- Grant all privileges to postgres user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Update sequence values to start after any existing data
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);
SELECT setval('accounts_id_seq', COALESCE((SELECT MAX(id) FROM accounts), 0) + 1, false);
SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM products), 0) + 1, false);
SELECT setval('drive_sessions_id_seq', COALESCE((SELECT MAX(id) FROM drive_sessions), 0) + 1, false);
SELECT setval('notifications_id_seq', COALESCE((SELECT MAX(id) FROM notifications), 0) + 1, false);

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

COMMIT;