-- Drop trigger
DROP TRIGGER IF EXISTS update_user_notification_tokens_updated_at ON user_notification_tokens;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop index
DROP INDEX IF EXISTS idx_user_notification_tokens_user_id;

-- Drop table
DROP TABLE IF EXISTS user_notification_tokens; 