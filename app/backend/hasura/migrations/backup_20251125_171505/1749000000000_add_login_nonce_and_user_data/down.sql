ALTER TABLE public.users
  DROP COLUMN IF EXISTS login_nonce,
  DROP COLUMN IF EXISTS login_nonce_expires_at,
  DROP COLUMN IF EXISTS data;

