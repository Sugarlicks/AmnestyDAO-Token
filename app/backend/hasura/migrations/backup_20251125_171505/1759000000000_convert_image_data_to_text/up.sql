-- Convert image columns from BYTEA to TEXT (base64 strings)
-- This ensures consistent base64 format for all image data

-- Convert contributions.image_data from BYTEA to TEXT (base64)
ALTER TABLE public.contributions 
  ALTER COLUMN image_data TYPE TEXT 
  USING encode(image_data, 'base64');

-- Convert campaigns.image_data from BYTEA to TEXT (base64)
ALTER TABLE public.campaigns 
  ALTER COLUMN image_data TYPE TEXT 
  USING encode(image_data, 'base64');

-- Convert chats.image from bytea to TEXT (base64)
ALTER TABLE public.chats 
  ALTER COLUMN image TYPE TEXT 
  USING encode(image, 'base64');

-- Convert users.profile_image from bytea to TEXT (base64)
ALTER TABLE public.users 
  ALTER COLUMN profile_image TYPE TEXT 
  USING encode(profile_image, 'base64');

