/*
  # Create users table

  1. New Tables
    - `users`
      - `id` (bigint, primary key, auto increment)
      - `uuid` (varchar, unique, not null)
      - `phone` (varchar, unique, not null)
      - `country_code` (varchar, default '+86')
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
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    country_code VARCHAR(5) NOT NULL DEFAULT '+86',
    
    password_hash VARCHAR(255) NOT NULL,
    password_changed_at TIMESTAMP NULL DEFAULT NULL,
    
    -- Profile Information
    display_name VARCHAR(20),
    first_name VARCHAR(10),
    last_name VARCHAR(10),
    bio TEXT,
    avatar_url VARCHAR(500),
    cover_photo_url VARCHAR(500),
    birth_date DATE,
    gender ENUM('male', 'female', 'other'),
    location VARCHAR(100),
    website VARCHAR(255),
    occupation VARCHAR(100),
    education VARCHAR(100),
    relationship_status ENUM('single', 'in_relationship', 'married', 'complicated'),
    languages JSON DEFAULT ('["zh-CN"]'),
    
    -- Account Status
    phone_verified BOOLEAN DEFAULT FALSE, --phone number verification
    phone_verified_at TIMESTAMP NULL,
    is_verified BOOLEAN DEFAULT FALSE, --ID verification
    verification_data JSON,
    is_private BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'deactivated', 'pending_deletion', 'suspended') NOT NULL DEFAULT 'active',
    suspension_reason TEXT,
    suspension_until TIMESTAMP NULL,
    
    -- Tracking
    last_login TIMESTAMP,
    login_count INT DEFAULT 0,
    registration_ip VARCHAR(45),
    last_ip VARCHAR(45),
    failed_login_attempts INT DEFAULT 0,
    last_failed_login TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP NULL,
    pending_deletion_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_phone (phone),
    INDEX idx_uuid (uuid),
    INDEX idx_display_name (display_name),
    INDEX idx_status (status),
    INDEX idx_phone_verified (phone_verified),
    INDEX idx_created_at (created_at),
    INDEX idx_display_name_status (display_name, status),
    INDEX idx_status_lastlogin (status, last_login)
);