-- Drop existing tables
DROP TABLE IF EXISTS drive_sessions;
DROP TABLE IF EXISTS product_combos;
DROP TABLE IF EXISTS commission_logs;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;

-- Create Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  referral_code VARCHAR(10) UNIQUE NOT NULL,
  upliner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tier VARCHAR(10) DEFAULT 'bronze',
  revenue_source VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Accounts table
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(10) CHECK (type IN ('main', 'training')),
  balance DECIMAL(12,2) DEFAULT 0,
  commission DECIMAL(12,2) DEFAULT 0,
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
  commission_rate DECIMAL(5, 4) NOT NULL, -- e.g., 0.015 for 1.5%
  min_balance_required DECIMAL(10, 2) DEFAULT 0, -- Balance needed to interact
  min_tier VARCHAR(10) DEFAULT 'bronze', -- Tier required (optional)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Combos table (Optional - can be handled via product relations if simple)
CREATE TABLE product_combos (
    id SERIAL PRIMARY KEY,
    product_ids INTEGER[] NOT NULL, -- Array of product IDs
    combo_price DECIMAL(10, 2) NOT NULL,
    combo_commission_rate DECIMAL(5, 4) NOT NULL,
    min_balance_required DECIMAL(10, 2) DEFAULT 0,
    min_tier VARCHAR(10) DEFAULT 'bronze',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

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

-- Add initial admin user (optional)
INSERT INTO users (username, email, password_hash, referral_code, tier, revenue_source)
VALUES ('admin', 'admin@example.com', '$2b$10$placeholderhash', 'SETYJWFC', 'platinum', 'admin');

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

-- Table for Drive Sessions
CREATE TABLE drive_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_combo_id INTEGER REFERENCES product_combos(id) ON DELETE SET NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(20) CHECK (status IN ('started', 'completed', 'cancelled')) DEFAULT 'started',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
