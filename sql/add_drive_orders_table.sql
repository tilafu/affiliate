-- Add drive_orders table
CREATE TABLE drive_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    product_id INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tasks_required INT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES drive_sessions(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
