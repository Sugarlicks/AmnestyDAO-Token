-- Remove index
DROP INDEX IF EXISTS idx_users_country;

-- Remove country and language columns from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS country;
ALTER TABLE public.users DROP COLUMN IF EXISTS language;

