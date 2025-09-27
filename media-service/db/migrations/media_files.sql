/*
  # Create media files table

  1. New Tables
    - `media_files`
      - `id` (bigint, primary key, auto increment)
      - `uuid` (varchar, unique, not null)
      - `user_id` (bigint, not null, indexed)
      - `original_filename` (varchar, not null)
      - `file_type` (enum: image, video, live_photo)
      - `media_type` (enum: profile, cover, post, story, message)
      - `mime_type` (varchar, not null)
      - `file_size` (bigint, not null)
      - `file_hash` (varchar, not null, indexed)
      - `storage_path` (varchar, not null)
      - `cdn_url` (varchar, nullable)
      - `processing_status` (enum: pending, processing, completed, failed)
      - `malware_scan_status` (enum: pending, scanning, clean, infected, failed)
      - `malware_scan_result` (json, nullable)
      - `is_public` (boolean, default false)
      - `is_deleted` (boolean, default false)
      - `deleted_at` (timestamp, nullable)
      - `expires_at` (timestamp, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  2. Security
    - Indexes for performance optimization
    - Foreign key constraints for data integrity
*/

CREATE TABLE IF NOT EXISTS media_files (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type ENUM('image', 'video', 'live_photo') NOT NULL,
    media_type ENUM('profile', 'cover', 'post', 'story', 'message') NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    cdn_url VARCHAR(500),
    processing_status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    malware_scan_status ENUM('pending', 'scanning', 'clean', 'infected', 'failed') NOT NULL DEFAULT 'pending',
    malware_scan_result JSON,
    is_public BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_file_type (file_type),
    INDEX idx_media_type (media_type),
    INDEX idx_file_hash (file_hash),
    INDEX idx_processing_status (processing_status),
    INDEX idx_malware_scan_status (malware_scan_status),
    INDEX idx_is_public (is_public),
    INDEX idx_is_deleted (is_deleted),
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at),
    INDEX idx_user_media_type (user_id, media_type),
    INDEX idx_file_processing (file_type, processing_status),
    INDEX idx_deleted_at (is_deleted, deleted_at)
);