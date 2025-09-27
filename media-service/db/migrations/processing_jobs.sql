/*
  # Create processing jobs table

  1. New Tables
    - `processing_jobs`
      - `id` (bigint, primary key, auto increment)
      - `job_id` (varchar, unique, not null)
      - `media_file_id` (bigint, foreign key to media_files)
      - `job_type` (enum: image_processing, video_processing, malware_scan, thumbnail_generation, format_conversion, live_photo_processing)
      - `status` (enum: pending, processing, completed, failed, cancelled)
      - `priority` (tinyint, not null, default 5)
      - `progress` (tinyint, not null, default 0)
      - `processing_options` (json, nullable)
      - `result_data` (json, nullable)
      - `error_message` (text, nullable)
      - `started_at` (timestamp, nullable)
      - `completed_at` (timestamp, nullable)
      - `processing_time` (int, nullable)
      - `worker_id` (varchar, nullable)
      - `retry_count` (tinyint, not null, default 0)
      - `max_retries` (tinyint, not null, default 3)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  2. Security
    - Foreign key constraint to media_files table with CASCADE delete
    - Indexes for performance optimization
*/

CREATE TABLE IF NOT EXISTS processing_jobs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    job_id VARCHAR(36) UNIQUE NOT NULL,
    media_file_id BIGINT UNSIGNED NOT NULL,
    job_type ENUM('image_processing', 'video_processing', 'malware_scan', 'thumbnail_generation', 'format_conversion', 'live_photo_processing') NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    priority TINYINT UNSIGNED NOT NULL DEFAULT 5,
    progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
    processing_options JSON,
    result_data JSON,
    error_message TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    processing_time INT UNSIGNED COMMENT 'Processing time in milliseconds',
    worker_id VARCHAR(100),
    retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    max_retries TINYINT UNSIGNED NOT NULL DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (media_file_id) REFERENCES media_files(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_media_file_id (media_file_id),
    INDEX idx_job_type (job_type),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_job_type_status (job_type, status),
    INDEX idx_status_priority (status, priority),
    INDEX idx_created_at (created_at),
    INDEX idx_worker_id (worker_id),
    INDEX idx_completed_at (completed_at)
);