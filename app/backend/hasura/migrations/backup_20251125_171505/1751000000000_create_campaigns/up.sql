-- Create campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    full_details TEXT,
    image_url TEXT,
    image_data BYTEA,
    
    -- Campaign-specific fields
    goal_tokens DECIMAL(20, 2) NOT NULL DEFAULT 0,
    tokens_raised DECIMAL(20, 2) NOT NULL DEFAULT 0,
    category TEXT CHECK (category IN (
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
    country TEXT,
    language TEXT,
    deadline TIMESTAMP WITH TIME ZONE,
    supporter_count INTEGER DEFAULT 0,
    campaign_url TEXT, -- External URL where users can learn more about the campaign
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id)
);

-- Create campaign_donations table to track user donations
CREATE TABLE IF NOT EXISTS public.campaign_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    amount DECIMAL(20, 2) NOT NULL,
    donated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Link to token transaction (if using blockchain)
    transaction_id UUID REFERENCES token_transactions(id),
    
    UNIQUE(campaign_id, user_id, donated_at) -- Allow multiple donations but prevent duplicates
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_is_active ON public.campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON public.campaigns(category);
CREATE INDEX IF NOT EXISTS idx_campaign_donations_campaign_id ON public.campaign_donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_donations_user_id ON public.campaign_donations(user_id);

-- Create function to update campaign tokens_raised and supporter_count
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

-- Create trigger to update campaign stats
CREATE TRIGGER campaign_donations_trigger
AFTER INSERT OR DELETE ON campaign_donations
FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at_trigger
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION update_campaigns_updated_at();

