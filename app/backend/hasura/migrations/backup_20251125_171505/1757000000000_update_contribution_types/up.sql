-- Update contribution_type constraint to allow 'visit', 'share', 'scan'
-- First, drop the old constraint
ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_contribution_type_check;

-- Update existing records FIRST (before adding new constraint): map old types to new types
-- 'petition' -> 'visit', 'article' -> 'share', 'event' -> 'scan', 'other' -> 'visit'
UPDATE public.contributions 
SET contribution_type = CASE 
  WHEN contribution_type = 'petition' THEN 'visit'
  WHEN contribution_type = 'article' THEN 'share'
  WHEN contribution_type = 'event' THEN 'scan'
  WHEN contribution_type = 'other' THEN 'visit'
  ELSE 'visit'
END;

-- Now add new constraint with updated values (after data is migrated)
ALTER TABLE public.contributions ADD CONSTRAINT contributions_contribution_type_check 
  CHECK (contribution_type IN ('visit', 'share', 'scan'));

