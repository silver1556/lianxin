/*
  # Create media variants table

  1. New Tables
    - `media_variants`
      - `id` (bigint, primary key, auto increment)
      - `media_file_id` (bigint, foreign key to media_files)
      - `variant_type` (enum: thumbnail, small, medium, large, original, mobile, desktop, 360p, 480p, 720p, 1080p)
      - `format` (varchar, not null)
      - `width` (int, nullable)
      - `height` (int, nullable)
      - `file_size` (bigint, not null)
      - `quality` (tinyint, nullable)
      - `bitrate` (varchar, nullable)
      - `duration` (decimal, nullable)
      - `storage_path` (varchar, not null)
      - `cdn_url` (varchar, nullable)
      - `processing_time` (int, nullable)
      - `is_optimized` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  2. Security
    - Foreign key constraint to media_files table with CASCADE delete
    - Unique constraint on media_file_id and variant_type
    - Indexes for performance optimization
*/

CREATE TABLE IF NOT EXISTS media_variants (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    media_file_id BIGINT UNSIGNED NOT NULL,
    variant_type ENUM('thumbnail', 'small', 'medium', 'large', 'original', 'mobile', 'desktop', '360p', '480p', '720p', '1080p') NOT NULL,
    format VARCHAR(10) NOT NULL,
    width INT UNSIGNED,
    height INT UNSIGNED,
    file_size BIGINT UNSIGNED NOT NULL,
    quality TINYINT UNSIGNED,
    bitrate VARCHAR(20),
    duration DECIMAL(10, 3),
    storage_path VARCHAR(500) NOT NULL,
    cdn_url VARCHAR(500),
    processing_time INT UNSIGNED COMMENT 'Processing time in milliseconds',
    is_optimized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (media_file_id) REFERENCES media_files(id) ON DELETE CASCADE,
    
    -- Indexes
    UNIQUE INDEX idx_media_variant_unique (media_file_id, variant_type),
    INDEX idx_variant_type (variant_type),
    INDEX idx_format (format),
    INDEX idx_dimensions (width, height),
    INDEX idx_file_size (file_size),
    INDEX idx_is_optimized (is_optimized)
);