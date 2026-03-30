CREATE TABLE public.chat_read_timestamps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    chat_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_read_timestamps_pkey PRIMARY KEY (id),
    CONSTRAINT chat_read_timestamps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE,
    CONSTRAINT chat_read_timestamps_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_chat_read UNIQUE (user_id, chat_id)
); 