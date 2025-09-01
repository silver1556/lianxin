/*
  # Create user privacy settings table
  (per-field visibility settings)

*/

CREATE TABLE IF NOT EXISTS user_privacy_settings (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    field_name VARCHAR(50) NOT NULL, -- e.g. "birth_date", "salary", "hometown"
    visibility ENUM('public', 'friends', 'private') NOT NULL DEFAULT 'public',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

    -- Ensure one setting per field per user
    UNIQUE KEY unique_user_field (user_id, field_name),
    
    CONSTRAINT fk_privacy_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Index for faster lookups
    INDEX idx_privacy_user (user_id)
);
