-- Create table for storing onboarding responses
CREATE TABLE IF NOT EXISTS onboarding_responses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255),
    question_1 VARCHAR(100), -- Monthly earning goal
    question_2 VARCHAR(100), -- Motivation to join CDOT
    question_3 VARCHAR(100), -- Barriers to starting
    question_4 VARCHAR(100), -- Future vision with CDOT
    question_5 VARCHAR(100), -- Featured as success story
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON onboarding_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_email ON onboarding_responses(email);
CREATE INDEX IF NOT EXISTS idx_onboarding_created_at ON onboarding_responses(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_onboarding_updated_at
    BEFORE UPDATE ON onboarding_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_onboarding_updated_at();
