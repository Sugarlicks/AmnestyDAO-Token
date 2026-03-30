-- Rollback: Convert image columns back from TEXT to BYTEA
-- WARNING: This will only work if the TEXT data is valid base64

-- Convert contributions.image_data back to BYTEA
ALTER TABLE public.contributions 
  ALTER COLUMN image_data TYPE BYTEA 
  USING decode(image_data, 'base64');

-- Convert campaigns.image_data back to BYTEA
ALTER TABLE public.campaigns 
  ALTER COLUMN image_data TYPE BYTEA 
  USING decode(image_data, 'base64');

-- Convert chats.image back to bytea
ALTER TABLE public.chats 
  ALTER COLUMN image TYPE bytea 
  USING decode(image, 'base64');

-- Convert users.profile_image back to bytea
ALTER TABLE public.users 
  ALTER COLUMN profile_image TYPE bytea 
  USING decode(profile_image, 'base64');

