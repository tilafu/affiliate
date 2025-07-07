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
  image_url VARCHAR(255), -- Added image URL column
  min_balance_required DECIMAL(10, 2) DEFAULT 0, -- Balance needed to interact
  min_tier VARCHAR(10) DEFAULT 'bronze', -- Tier required (optional)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Combos table
CREATE TABLE product_combos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- Added name for the combo itself
    product_ids INTEGER[] NOT NULL, -- Array of product IDs
    combo_price DECIMAL(10, 2) NOT NULL,
    combo_commission_rate DECIMAL(5, 4) NOT NULL,
    image_url VARCHAR(255), -- Image for the combo (can be one of the product images or a specific one)
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

-- Insert sample products based on image filenames
-- Assuming base path is 'assets/uploads/products/'
INSERT INTO products (name, price, commission_rate, image_url) VALUES
('Stylish Bag', 45.50, 0.015, 'assets/uploads/products/bag.jpeg'),
('Comfort Bra', 22.00, 0.012, 'assets/uploads/products/bra.PNG'),
('Wooden Closet', 180.00, 0.025, 'assets/uploads/products/closet.jpeg'),
('Gaming Controller', 59.99, 0.018, 'assets/uploads/products/controller.jpeg'),
('Water Jug', 15.00, 0.010, 'assets/uploads/products/jug.jpeg'),
('Khaki Trousers', 35.00, 0.014, 'assets/uploads/products/khaki.jpg'),
('Makeup Set', 65.00, 0.020, 'assets/uploads/products/makeup.jpg'),
('Smartphone', 399.00, 0.030, 'assets/uploads/products/phone.jpeg'),
('Monitor Screen', 250.00, 0.022, 'assets/uploads/products/screen.jpeg'),
('Running Shoe', 75.00, 0.016, 'assets/uploads/products/shoe.jpeg'),
('Bluetooth Speaker', 89.90, 0.019, 'assets/uploads/products/sound.jpg'),
('Elegant Watch', 120.00, 0.021, 'assets/uploads/products/watch.jpeg');

-- Insert sample product combos (one combo per product for simplicity)
-- Assuming product IDs 1-12 correspond to the inserts above
INSERT INTO product_combos (name, product_ids, combo_price, combo_commission_rate, image_url, min_balance_required, min_tier, is_active) VALUES
('Stylish Bag Drive', '{1}', 45.50, 0.015, 'assets/uploads/products/bag.jpeg', 0, 'bronze', true),
('Comfort Bra Drive', '{2}', 22.00, 0.012, 'assets/uploads/products/bra.PNG', 0, 'bronze', true),
('Wooden Closet Drive', '{3}', 180.00, 0.025, 'assets/uploads/products/closet.jpeg', 50, 'bronze', true), -- Example higher balance
('Gaming Controller Drive', '{4}', 59.99, 0.018, 'assets/uploads/products/controller.jpeg', 0, 'bronze', true),
('Water Jug Drive', '{5}', 15.00, 0.010, 'assets/uploads/products/jug.jpeg', 0, 'bronze', true),
('Khaki Trousers Drive', '{6}', 35.00, 0.014, 'assets/uploads/products/khaki.jpg', 0, 'bronze', true),
('Makeup Set Drive', '{7}', 65.00, 0.020, 'assets/uploads/products/makeup.jpg', 20, 'bronze', true), -- Example balance req
('Smartphone Drive', '{8}', 399.00, 0.030, 'assets/uploads/products/phone.jpeg', 100, 'silver', true), -- Example tier req
('Monitor Screen Drive', '{9}', 250.00, 0.022, 'assets/uploads/products/screen.jpeg', 75, 'bronze', true),
('Running Shoe Drive', '{10}', 75.00, 0.016, 'assets/uploads/products/shoe.jpeg', 0, 'bronze', true),
('Bluetooth Speaker Drive', '{11}', 89.90, 0.019, 'assets/uploads/products/sound.jpg', 0, 'bronze', true),
('Elegant Watch Drive', '{12}', 120.00, 0.021, 'assets/uploads/products/watch.jpeg', 30, 'bronze', true);

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
