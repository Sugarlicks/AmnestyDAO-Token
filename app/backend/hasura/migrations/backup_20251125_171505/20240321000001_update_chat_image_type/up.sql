-- Update the image column type in chats table
ALTER TABLE public.chats ALTER COLUMN image TYPE bytea USING image::bytea; 