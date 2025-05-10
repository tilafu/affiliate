-- Create Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  referral_code VARCHAR(10) UNIQUE NOT NULL,
  upliner_id INTEGER REFERENCES users(id),
  tier VARCHAR(10) DEFAULT 'bronze', -- Tier for regular users
  role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('user', 'admin')), -- Added role column
  revenue_source VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Accounts table
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(10) CHECK (type IN ('main', 'training')),
  balance DECIMAL(12,2) DEFAULT 0,
  frozen DECIMAL(12,2) DEFAULT 0,
  cap DECIMAL(12,2),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, type)
);

-- Create Products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(255) DEFAULT '/assets/uploads/product_default.png',
  commission_rate DECIMAL(5, 3) DEFAULT 0.01,
  min_balance_required DECIMAL(10, 2) DEFAULT 0, -- Balance needed to interact
  min_tier VARCHAR(10) DEFAULT 'bronze',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Combos table (Optional - can be handled via product relations if simple)
-- CREATE TABLE combos ( ... ); 

-- Create Transactions/Commission Logs table
CREATE TABLE commission_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id), -- User who earned the commission
  source_user_id INTEGER REFERENCES users(id), -- User whose action generated the commission (e.g., downliner)
  source_action_id INTEGER, -- ID of the drive item interaction or other source event
  account_type VARCHAR(10) CHECK (account_type IN ('main', 'training')), -- Which account received commission
  commission_amount DECIMAL(12, 2) NOT NULL,
  commission_type VARCHAR(20) NOT NULL CHECK (commission_type IN ('direct_drive', 'upline_bonus', 'training_bonus')), -- Type of commission
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Drive Sessions table
CREATE TABLE IF NOT EXISTS drive_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    drive_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    tasks_completed INTEGER DEFAULT 0,
    tasks_required INTEGER NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    session_uuid UUID UNIQUE,
    frozen_amount_needed DECIMAL,
    last_product_id INTEGER,
    last_combo_id VARCHAR(100),
    combo_progress JSONB,
    is_active BOOLEAN DEFAULT true
);

-- Create Drive Orders table
CREATE TABLE IF NOT EXISTS drive_orders (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES drive_sessions(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tasks_required INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create Withdrawal Addresses table
CREATE TABLE IF NOT EXISTS withdrawal_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    address_type VARCHAR(10) NOT NULL DEFAULT 'TRC20', -- Assuming TRC20 for now
    address VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, address_type) -- Allow one address per type per user
);

-- Add withdrawal_password_hash column to users table if it doesn't exist
-- Note: Running this multiple times is safe if the column already exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'withdrawal_password_hash'
    ) THEN
        ALTER TABLE users ADD COLUMN withdrawal_password_hash VARCHAR(100) NULL;
    END IF;
END $$;

-- Create Admin Notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id), -- User who triggered the event (optional, can be null for system events)
    type VARCHAR(50) NOT NULL, -- e.g., 'profile_update', 'address_update', 'new_support_message'
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Support Messages table (Simple Version)
CREATE TABLE IF NOT EXISTS support_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    sender_role VARCHAR(10) NOT NULL CHECK (sender_role IN ('user', 'admin')),
    recipient_id INTEGER REFERENCES users(id), -- NULL means message is for general support/all admins
    subject VARCHAR(255), -- Optional subject line
    message TEXT NOT NULL,
    thread_id INTEGER REFERENCES support_messages(id), -- Optional: Link replies to original message
    is_read BOOLEAN DEFAULT false, -- Read by recipient (admin for user messages, user for admin replies)
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Add initial admin user (optional) - Set role to 'admin' and tier can be null or default
INSERT INTO users (username, email, password_hash, referral_code, tier, role, revenue_source)
VALUES ('admin', 'admin@example.com', '$2b$10$placeholderhash', 'SETYJWFC', null, 'admin', 'admin');

-- Add admin accounts
INSERT INTO accounts (user_id, type, balance)
SELECT id, 'main', 10000 FROM users WHERE username = 'admin';
INSERT INTO accounts (user_id, type, balance, is_active)
SELECT id, 'training', 0, false FROM users WHERE username = 'admin';

-- Insert sample products
INSERT INTO products (name, price, commission_rate) VALUES
('Basic Data Drive', 10.00, 0.01); -- 1% commission
INSERT INTO products (name, price, commission_rate) VALUES
('Standard Data Drive', 25.00, 0.015); -- 1.5% commission
INSERT INTO products (name, price, commission_rate) VALUES
('Premium Data Drive', 50.00, 0.02);  -- 2% commission
INSERT INTO products (name, price, commission_rate, min_balance_required, min_tier) VALUES
('Enterprise Data Drive', 100.00, 0.025, 50.00, 'silver'); -- 2.5% commission, higher price, balance/tier requirements
