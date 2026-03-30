-- Revert contribution_type constraint fix
ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_contribution_type_check;

-- Restore original constraint (if needed)
-- Note: This assumes the original constraint allowed ('visit', 'share', 'scan')
ALTER TABLE public.contributions 
ADD CONSTRAINT contributions_contribution_type_check 
CHECK (contribution_type IN ('visit', 'share', 'scan'));



