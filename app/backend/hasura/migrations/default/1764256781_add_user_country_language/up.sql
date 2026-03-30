-- Add country and language columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS language TEXT;

-- Add index for country filtering
CREATE INDEX IF NOT EXISTS idx_users_country ON public.users(country);

