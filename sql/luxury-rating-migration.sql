-- Luxury Product Rating System Migration
-- Add tables for product ratings and commission tracking

-- Create product ratings table
CREATE TABLE IF NOT EXISTS product_ratings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    product_id INTEGER DEFAULT 0,
    product_name VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    commission_earned DECIMAL(10,2) DEFAULT 0.00,
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- Create user commission history table (if not exists)
CREATE TABLE IF NOT EXISTS user_commission_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'product_rating',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add commission_earned column to drive_sessions if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drive_sessions' 
        AND column_name = 'commission_earned'
    ) THEN
        ALTER TABLE drive_sessions ADD COLUMN commission_earned DECIMAL(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_ratings_user_id ON product_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_created_at ON product_ratings(created_at);
CREATE INDEX IF NOT EXISTS idx_user_commission_history_user_id ON user_commission_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_commission_history_created_at ON user_commission_history(created_at);

-- Insert sample data for testing (optional)
-- This can be commented out in production
/*
INSERT INTO product_ratings (user_id, product_id, product_name, rating, commission_earned, review_text)
VALUES 
    (1, 1, 'Sample Product 1', 5, 0.50, 'Great product, highly recommended!'),
    (1, 2, 'Sample Product 2', 4, 0.40, 'Good quality, fast delivery')
ON CONFLICT (user_id, product_id) DO NOTHING;
*/

COMMIT;
