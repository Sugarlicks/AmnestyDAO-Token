-- Drop indexes first
DROP INDEX IF EXISTS public.idx_app_logs_error_recent;
DROP INDEX IF EXISTS public.idx_app_logs_created_at;
DROP INDEX IF EXISTS public.idx_app_logs_timestamp;
DROP INDEX IF EXISTS public.idx_app_logs_user_id;
DROP INDEX IF EXISTS public.idx_app_logs_level;

-- Drop table
DROP TABLE IF EXISTS public.app_logs;



