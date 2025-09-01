/*
  # Create user settings table
  (global settings per user)

*/

CREATE TABLE IF NOT EXISTS user_settings (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
     -- Privacy defaults
    privacy_settings JSON NOT NULL DEFAULT ('{"profile_visibility":"public","search_visibility":true,"allow_friend_requests":true,"message_permissions":"friends","allow_tagging":"friends"}'),
    -- Notifications
    notification_settings JSON NOT NULL DEFAULT ('{"push_notifications":true,"friend_requests":true,"messages":true,"likes":true,"comments":true,"shares":false,"mentions":true,"group_activities":true, "event_reminders":true,"security_alerts":true}'),
    -- Display preferences
    display_settings JSON NOT NULL DEFAULT ('{"theme":"light","language":"zh-CN","font_size":"medium"}'),
    -- Security settings
    security_settings JSON NOT NULL DEFAULT ('{"login_alerts":true}'),

    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_settings_user (user_id)
);