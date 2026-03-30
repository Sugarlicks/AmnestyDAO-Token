ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS login_nonce text,
  ADD COLUMN IF NOT EXISTS login_nonce_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS data jsonb;

