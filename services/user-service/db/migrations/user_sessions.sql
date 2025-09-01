/*
  # Create user sessions table

  1. New Tables
    - `user_sessions`
      - `id` (bigint, primary key, auto increment)
      - `user_id` (bigint, foreign key to users)
      - `session_id` (varchar, unique, not null)
      - `refresh_token` (varchar, unique, not null)
      - `device_info` (json)
      - `ip_address` (varchar)
      - `user_agent` (text)
      - `location` (varchar)
      - `is_active` (boolean, default true)
      - `expires_at` (timestamp, not null)
      - `created_at` (timestamp)
      - `revoked_at` (timestamp, nullable)
  2. Security
    - Foreign key constraint to users table with CASCADE delete
    - Indexes for performance optimization
*/

CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    session_id CHAR(36) UNIQUE NOT NULL,
    refresh_token CHAR(64) UNIQUE NOT NULL,
    device_info JSON NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    location JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    refresh_issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_refresh_token (refresh_token),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_active (is_active),
    INDEX idx_user_id_is_active (user_id, is_active),
    INDEX idx_last_active_at (last_active_at)
);