-- Rollback script for initial migration
-- This will drop all tables, functions, and triggers created in the initial migration

-- Drop triggers first
DROP TRIGGER IF EXISTS update_user_notification_tokens_updated_at ON user_notification_tokens;
DROP TRIGGER IF EXISTS campaigns_updated_at_trigger ON campaigns;
DROP TRIGGER IF EXISTS campaign_donations_trigger ON campaign_donations;
DROP TRIGGER IF EXISTS contributions_updated_at_trigger ON contributions;
DROP TRIGGER IF EXISTS contribution_participants_trigger ON user_contributions;
DROP TRIGGER IF EXISTS update_member_count_after_delete ON public.chat_participants;
DROP TRIGGER IF EXISTS update_member_count_after_insert ON public.chat_participants;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS update_campaigns_updated_at();
DROP FUNCTION IF EXISTS update_campaign_stats();
DROP FUNCTION IF EXISTS update_contributions_updated_at();
DROP FUNCTION IF EXISTS update_contribution_participants();
DROP FUNCTION IF EXISTS public.update_chat_member_count();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS user_notification_tokens;
DROP TABLE IF EXISTS token_transactions;
DROP TABLE IF EXISTS campaign_donations;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS user_contributions;
DROP TABLE IF EXISTS contributions;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS chat_read_timestamps;
DROP TABLE IF EXISTS chat_participants;
DROP TABLE IF EXISTS chats;
DROP TABLE IF EXISTS users;

-- Drop extension (optional - only if not used elsewhere)
-- DROP EXTENSION IF EXISTS "uuid-ossp";

