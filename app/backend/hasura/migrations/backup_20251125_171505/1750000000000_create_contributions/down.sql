-- Drop triggers
DROP TRIGGER IF EXISTS contributions_updated_at_trigger ON public.contributions;
DROP TRIGGER IF EXISTS contribution_participants_trigger ON public.user_contributions;

-- Drop functions
DROP FUNCTION IF EXISTS update_contributions_updated_at();
DROP FUNCTION IF EXISTS update_contribution_participants();

-- Drop indexes
DROP INDEX IF EXISTS idx_contributions_is_active;
DROP INDEX IF EXISTS idx_user_contributions_contribution_id;
DROP INDEX IF EXISTS idx_user_contributions_user_id;

-- Drop tables
DROP TABLE IF EXISTS public.user_contributions;
DROP TABLE IF EXISTS public.contributions;

