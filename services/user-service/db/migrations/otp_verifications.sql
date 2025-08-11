/*
  # Create OTP verifications table

  1. New Tables
    - `otp_verifications`
      - `id` (bigint, primary key, auto increment)
      - `verification_id` (varchar, unique, UUID)
      - `user_id` (bigint, nullable, foreign key to users)
      - `phone` (varchar, not null)
      - `country_code` (varchar, default '+86')
      - `otp_code` (varchar, 6 digits)
      - `otp_type` (enum: registration, login, password_reset, phone_number_change)
      - `is_verified` (boolean, default false)
      - `attempts` (tinyint, default 0)
      - `max_attempts` (tinyint, default 3)
      - `ip_address` (varchar)
      - `expires_at` (timestamp, not null)
      - `verified_at` (timestamp, nullable)
      - `created_at` (timestamp)
  2. Security
    - Foreign key constraint to users table with CASCADE delete
    - Indexes for performance and cleanup optimization
*/

CREATE TABLE IF NOT EXISTS otp_verifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    verification_id VARCHAR(36) UNIQUE NOT NULL,
    user_id BIGINT NULL,
    phone VARCHAR(20) NOT NULL,
    country_code VARCHAR(5) NOT NULL DEFAULT '+86',
    otp_code VARCHAR(6) NOT NULL,
    otp_type ENUM('registration', 'login', 'password_reset', 'phone_number_change') NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 3,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_verification_id (verification_id),
    INDEX idx_phone_country_code (phone, country_code),
    INDEX idx_otp_type (otp_type),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_verified_expires_at (is_verified, expires_at),
    INDEX idx_user_id (user_id)
);