SET check_function_bodies = false;

-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
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
    profile_image text, -- Base64 encoded image data
    login_nonce text,
    login_nonce_expires_at timestamp with time zone,
    data jsonb,
    email text,
    CONSTRAINT users_pkey PRIMARY KEY (user_id)
);

-- ============================================================================
-- CHATS TABLE
-- ============================================================================
CREATE TABLE public.chats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    image bytea, -- Note: chats.image remains bytea (per migration 20240321000001)
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    member_count integer DEFAULT 1,
    CONSTRAINT chats_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- CHAT PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE public.chat_participants (
    chat_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_participants_pkey PRIMARY KEY (chat_id, user_id),
    CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE,
    CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- ============================================================================
-- CHAT READ TIMESTAMPS TABLE
-- ============================================================================
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

-- ============================================================================
-- MEMBERSHIPS TABLE
-- ============================================================================
CREATE TABLE public.memberships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    chat_id uuid NOT NULL,
    role text NOT NULL,
    CONSTRAINT memberships_pkey PRIMARY KEY (id),
    CONSTRAINT memberships_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
    CONSTRAINT memberships_device_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chat_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_pkey PRIMARY KEY (id),
    CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
    CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(user_id)
);

-- ============================================================================
-- CONTRIBUTIONS TABLE
-- ============================================================================
CREATE TABLE public.contributions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL,
    full_details text,
    image_url text,
    image_data text, -- Base64 encoded image data
    token_reward decimal(20, 2) NOT NULL DEFAULT 0,
    contribution_type text NOT NULL CHECK (contribution_type IN ('visit', 'share', 'scan')),
    action_button_text text DEFAULT 'Complete Action',
    external_link text,
    deadline timestamp with time zone,
    target_participants integer,
    current_participants integer DEFAULT 0,
    country text,
    language text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    created_by uuid REFERENCES users(user_id)
);

-- ============================================================================
-- USER CONTRIBUTIONS TABLE
-- ============================================================================
CREATE TABLE public.user_contributions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(user_id),
    contribution_id uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    completed_at timestamp with time zone DEFAULT NOW(),
    tokens_awarded decimal(20, 2) NOT NULL DEFAULT 0,
    UNIQUE(user_id, contribution_id)
);

-- ============================================================================
-- TOKEN TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE public.token_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id uuid REFERENCES users(user_id),
    to_user_id uuid REFERENCES users(user_id),
    amount decimal(20, 2), -- Nullable (per migration 1754000000000)
    description text,
    transaction_type text NOT NULL CHECK (transaction_type IN ('TRANSFER', 'TREASURY_DEPOSIT', 'TREASURY_WITHDRAWAL', 'REWARD', 'DONATION')),
    timestamp timestamp with time zone DEFAULT NOW(),
    created_at timestamp with time zone DEFAULT NOW(),
    -- Additional columns from migration 1752000000000
    cardano_tx_hash text UNIQUE,
    from_wallet_address text,
    to_wallet_address text,
    token_amount decimal(20, 2),
    contribution_id uuid REFERENCES contributions(id),
    campaign_id uuid,
    transaction_status text CHECK (transaction_status IN ('PENDING', 'CONFIRMED', 'FAILED')) DEFAULT 'PENDING',
    confirmed_at timestamp with time zone,
    error_message text,
    user_id uuid REFERENCES users(user_id)
);

-- ============================================================================
-- CAMPAIGNS TABLE
-- ============================================================================
CREATE TABLE public.campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL,
    full_details text,
    image_url text,
    image_data text, -- Base64 encoded image data
    goal_tokens decimal(20, 2) NOT NULL DEFAULT 0,
    tokens_raised decimal(20, 2) NOT NULL DEFAULT 0,
    category text CHECK (category IN (
        'Freedom of Expression',
        'Environmental Rights',
        'Children''s Rights',
        'Refugee Rights',
        'Women''s Rights',
        'LGBTQ+ Rights',
        'Digital Rights',
        'Economic Justice',
        'Other'
    )),
    country text,
    language text,
    deadline timestamp with time zone,
    supporter_count integer DEFAULT 0,
    campaign_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    created_by uuid REFERENCES users(user_id)
);

-- ============================================================================
-- CAMPAIGN DONATIONS TABLE
-- ============================================================================
CREATE TABLE public.campaign_donations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(user_id),
    amount decimal(20, 2) NOT NULL,
    donated_at timestamp with time zone DEFAULT NOW(),
    transaction_id uuid REFERENCES token_transactions(id),
    UNIQUE(campaign_id, user_id, donated_at)
);

-- ============================================================================
-- USER NOTIFICATION TOKENS TABLE
-- ============================================================================
CREATE TABLE public.user_notification_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token text NOT NULL,
    platform text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_contributions_user_id ON public.user_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contributions_contribution_id ON public.user_contributions(contribution_id);
CREATE INDEX IF NOT EXISTS idx_contributions_is_active ON public.contributions(is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_active ON public.campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON public.campaigns(category);
CREATE INDEX IF NOT EXISTS idx_campaign_donations_campaign_id ON public.campaign_donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_donations_user_id ON public.campaign_donations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_cardano_tx_hash ON token_transactions(cardano_tx_hash);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_status ON token_transactions(transaction_status);
CREATE INDEX IF NOT EXISTS idx_token_transactions_from_wallet ON token_transactions(from_wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_transactions_to_wallet ON token_transactions(to_wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_transactions_contribution_id ON token_transactions(contribution_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_campaign_id ON token_transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_tokens_user_id ON user_notification_tokens(user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update chat member count
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

-- Function to update contribution participants count
CREATE OR REPLACE FUNCTION update_contribution_participants()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE contributions
        SET current_participants = current_participants + 1
        WHERE id = NEW.contribution_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE contributions
        SET current_participants = GREATEST(current_participants - 1, 0)
        WHERE id = OLD.contribution_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update contributions updated_at timestamp
CREATE OR REPLACE FUNCTION update_contributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE campaigns
        SET tokens_raised = tokens_raised + NEW.amount,
            supporter_count = (
                SELECT COUNT(DISTINCT user_id)
                FROM campaign_donations
                WHERE campaign_id = NEW.campaign_id
            ),
            updated_at = NOW()
        WHERE id = NEW.campaign_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE campaigns
        SET tokens_raised = tokens_raised - OLD.amount,
            supporter_count = (
                SELECT COUNT(DISTINCT user_id)
                FROM campaign_donations
                WHERE campaign_id = OLD.campaign_id
            ),
            updated_at = NOW()
        WHERE id = OLD.campaign_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update campaigns updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update user_notification_tokens updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Chat member count triggers
CREATE TRIGGER update_member_count_after_insert AFTER INSERT ON public.chat_participants FOR EACH ROW EXECUTE FUNCTION public.update_chat_member_count();
CREATE TRIGGER update_member_count_after_delete AFTER DELETE ON public.chat_participants FOR EACH ROW EXECUTE FUNCTION public.update_chat_member_count();

-- Contribution participants trigger
CREATE TRIGGER contribution_participants_trigger
AFTER INSERT OR DELETE ON public.user_contributions
FOR EACH ROW
EXECUTE FUNCTION update_contribution_participants();

-- Contributions updated_at trigger
CREATE TRIGGER contributions_updated_at_trigger
BEFORE UPDATE ON public.contributions
FOR EACH ROW
EXECUTE FUNCTION update_contributions_updated_at();

-- Campaign stats trigger
CREATE TRIGGER campaign_donations_trigger
AFTER INSERT OR DELETE ON campaign_donations
FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

-- Campaigns updated_at trigger
CREATE TRIGGER campaigns_updated_at_trigger
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();

-- User notification tokens updated_at trigger
CREATE TRIGGER update_user_notification_tokens_updated_at
    BEFORE UPDATE ON user_notification_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

