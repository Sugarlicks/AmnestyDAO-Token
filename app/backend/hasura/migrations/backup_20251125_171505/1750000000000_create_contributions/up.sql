-- Create contributions table
CREATE TABLE IF NOT EXISTS public.contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    full_details TEXT,
    image_url TEXT,
    image_data BYTEA,
    token_reward DECIMAL(20, 2) NOT NULL DEFAULT 0,
    contribution_type TEXT NOT NULL CHECK (contribution_type IN ('petition', 'article', 'event', 'other')),
    action_button_text TEXT DEFAULT 'Complete Action',
    external_link TEXT,
    deadline TIMESTAMP WITH TIME ZONE,
    target_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    country TEXT,
    language TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id)
);

-- Create user_contributions table to track completed contributions
CREATE TABLE IF NOT EXISTS public.user_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tokens_awarded DECIMAL(20, 2) NOT NULL DEFAULT 0,
    UNIQUE(user_id, contribution_id)
);

-- Create index on user_contributions for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_contributions_user_id ON public.user_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contributions_contribution_id ON public.user_contributions(contribution_id);
CREATE INDEX IF NOT EXISTS idx_contributions_is_active ON public.contributions(is_active);

-- Create function to update contribution current_participants count
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

-- Create trigger to update participant count
CREATE TRIGGER contribution_participants_trigger
AFTER INSERT OR DELETE ON public.user_contributions
FOR EACH ROW
EXECUTE FUNCTION update_contribution_participants();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contributions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER contributions_updated_at_trigger
BEFORE UPDATE ON public.contributions
FOR EACH ROW
EXECUTE FUNCTION update_contributions_updated_at();

