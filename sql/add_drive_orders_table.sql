-- Add drive_orders table
CREATE TABLE IF NOT EXISTS drive_orders (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tasks_required INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES drive_sessions(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
