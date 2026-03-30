SET check_function_bodies = false;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE FUNCTION public.update_chat_member_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chats
        SET member_count = member_count + 1
        WHERE id = NEW.chat_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chats
        SET member_count = member_count - 1
        WHERE id = OLD.chat_id;
    END IF;
    RETURN NULL;
END;
$$;
CREATE TABLE public.chat_participants (
    chat_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.chats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    image bytea,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    member_count integer DEFAULT 1
);
CREATE TABLE public.memberships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    chat_id uuid NOT NULL,
    role text NOT NULL
);
CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chat_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.users (
    user_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    public_key text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name text DEFAULT ''::text NOT NULL,
    reason text,
    last_name text DEFAULT ''::text NOT NULL,
    preferred_name text,
    affiliations text[] DEFAULT '{}'::text[],
    profile_image bytea
);
ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_pkey PRIMARY KEY (chat_id, user_id);
ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);
CREATE TRIGGER update_member_count_after_delete AFTER DELETE ON public.chat_participants FOR EACH ROW EXECUTE FUNCTION public.update_chat_member_count();
CREATE TRIGGER update_member_count_after_insert AFTER INSERT ON public.chat_participants FOR EACH ROW EXECUTE FUNCTION public.update_chat_member_count();
ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id);
ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_device_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id);
ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id);
