-- Revert contribution_type constraint to original values
-- First, drop the new constraint
ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_contribution_type_check;

-- Add old constraint
ALTER TABLE public.contributions ADD CONSTRAINT contributions_contribution_type_check 
  CHECK (contribution_type IN ('petition', 'article', 'event', 'other'));

-- Revert existing records: map new types back to old types
-- 'visit' -> 'petition', 'share' -> 'article', 'scan' -> 'event'
UPDATE public.contributions 
SET contribution_type = CASE 
  WHEN contribution_type = 'visit' THEN 'petition'
  WHEN contribution_type = 'share' THEN 'article'
  WHEN contribution_type = 'scan' THEN 'event'
  ELSE 'petition'
END;

