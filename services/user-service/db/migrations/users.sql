/*
  # Create users table

  1. New Tables
    - `users`
      - `id` (bigint, primary key, auto increment)
      - `uuid` (varchar, unique, not null)
      - `phone` (varchar, unique, not null)
      - `country_code` (varchar, default '86')
      - `password_hash` (varchar, not null)
      - `password_changed_at` (timestamp)
      - Profile fields (display_name, first_name, last_name, bio, etc.)
      - Account status fields (phone_verified, is_verified, is_private, status)
      - Tracking fields (last_login, login_count, registration_ip, etc.)
      - Timestamps (created_at, updated_at, deactivated_at, pending_deletion_at)
  2. Security
    - Add indexes for performance optimization
*/

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    phone VARCHAR(255) UNIQUE NOT NULL,
    phone_hash VARCHAR(64) UNIQUE NOT NULL,
    password_hash CHAR(60) NOT NULL,
    password_changed_at TIMESTAMP NULL DEFAULT NULL,
    password_history JSON NOT NULL DEFAULT ('[]'),
    
    -- Account Status
    is_verified BOOLEAN DEFAULT FALSE, -- ID verification
    status ENUM('active', 'deactivated', 'pending_deletion', 'suspended') NOT NULL DEFAULT 'active',
    suspension_reason TEXT,
    suspension_until TIMESTAMP NULL,
    
    -- Tracking
    last_login TIMESTAMP,
    registration_ip VARCHAR(45),
    last_ip VARCHAR(45),
    failed_login_attempts INT DEFAULT 0,
    last_failed_login TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP NULL,
    pending_deletion_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_phone_hash (phone_hash),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
);