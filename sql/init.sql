-- Create Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  referral_code VARCHAR(10) UNIQUE NOT NULL,
  upliner_id INTEGER REFERENCES users(id),
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

-- Add initial admin user (optional)
INSERT INTO users (username, email, password_hash, referral_code, tier, revenue_source)
VALUES ('admin', 'admin@example.com', '$2b$10$placeholderhash', 'SETYJWFC', 'platinum', 'admin');

-- Add admin accounts
INSERT INTO accounts (user_id, type, balance)
SELECT id, 'main', 10000 FROM users WHERE username = 'admin';
INSERT INTO accounts (user_id, type, balance, is_active)
SELECT id, 'training', 0, false FROM users WHERE username = 'admin';
