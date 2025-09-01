/*
  # Create audit logs table

  1. New Tables
    - `audit_logs`
      - `id` (bigint, primary key, auto increment)
      - `user_id` (bigint, nullable, foreign key to users)
      - `action` (varchar, not null)
      - `resource` (varchar, not null)
      - `resource_id` (varchar, nullable)
      - `old_values` (json, nullable)
      - `new_values` (json, nullable)
      - `ip_address` (varchar)
      - `user_agent` (text)
      - `session_id` (varchar)
      - `created_at` (timestamp)
  2. Security
    - Foreign key constraint to users table with SET NULL (preserve audit trail)
    - Indexes for performance and compliance queries
*/

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_resource (resource),
    INDEX idx_created_at (created_at),
    INDEX idx_user_id_action (user_id, action),
    INDEX idx_resource_resource_id (resource, resource_id)
);