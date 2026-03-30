-- Fix contribution_type constraint to ensure it allows 'visit', 'share', 'scan'
-- Drop existing constraint if it exists (handles different constraint names)
DO $$
BEGIN
    -- Try to drop constraint with standard name
    ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_contribution_type_check;
    
    -- Also try dropping constraint with space in name (if it exists)
    -- Note: PostgreSQL doesn't allow spaces in unquoted identifiers, but checking anyway
    EXECUTE 'ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS "contributions_ contribution_type_check"';
EXCEPTION
    WHEN undefined_object THEN
        -- Constraint doesn't exist, continue
        NULL;
END $$;

-- Update any existing records with invalid contribution_type values
UPDATE public.contributions 
SET contribution_type = CASE 
    WHEN contribution_type NOT IN ('visit', 'share', 'scan') THEN 'visit'
    ELSE contribution_type
END
WHERE contribution_type NOT IN ('visit', 'share', 'scan') OR contribution_type IS NULL;

-- Ensure no NULL values
UPDATE public.contributions 
SET contribution_type = 'visit'
WHERE contribution_type IS NULL;

-- Add the correct constraint
ALTER TABLE public.contributions 
ADD CONSTRAINT contributions_contribution_type_check 
CHECK (contribution_type IN ('visit', 'share', 'scan'));



