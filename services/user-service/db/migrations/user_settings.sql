/*
  # Create user settings table

  1. New Tables
    - `user_settings`
      - `id` (bigint, primary key, auto increment)
      - `user_id` (bigint, unique, foreign key to users)
      - `privacy_settings` (json, default empty object)
      - `notification_settings` (json, default empty object)
      - `display_settings` (json, default empty object)
      - `security_settings` (json, default empty object)
      - `updated_at` (timestamp)
  2. Security
    - Foreign key constraint to users table with CASCADE delete
    - Unique constraint on user_id to ensure one settings record per user
*/

CREATE TABLE IF NOT EXISTS user_settings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    privacy_settings JSON NOT NULL DEFAULT ('{"profile_visibility":"public","search_visibility":true,"show_online_status":true,"allow_friend_requests":true,"message_permissions":"friends","allow_tagging":"friends"}'),
    notification_settings JSON NOT NULL DEFAULT ('{"push_notifications":true,"friend_requests":true,"messages":true,"likes":true,"comments":true,"shares":false,"mentions":true,"group_activities":true, "event_reminders":true,"security_alerts":true}'),
    display_settings JSON NOT NULL DEFAULT ('{"theme":"light","language":"zh-CN","font_size":"medium"}'),
    security_settings JSON NOT NULL DEFAULT ('{"login_alerts":true}'),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_settings (user_id),
    
    -- Indexes
    INDEX idx_user_id (user_id)
);