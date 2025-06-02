-- Drop the table if it exists
DROP TABLE IF EXISTS support_messages;

-- Create Support Messages table
CREATE TABLE IF NOT EXISTS support_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    sender_role VARCHAR(10) NOT NULL CHECK (sender_role IN ('user', 'admin')),
    recipient_id INTEGER REFERENCES users(id), -- NULL means message is for general support/all admins
    subject VARCHAR(255), -- Optional subject line
    message TEXT NOT NULL,
    thread_id INTEGER REFERENCES support_messages(id), -- Optional: Link replies to original message
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);