DROP TRIGGER IF EXISTS campaigns_updated_at_trigger ON campaigns;
DROP TRIGGER IF EXISTS campaign_donations_trigger ON campaign_donations;
DROP FUNCTION IF EXISTS update_campaigns_updated_at();
DROP FUNCTION IF EXISTS update_campaign_stats();
DROP TABLE IF EXISTS public.campaign_donations;
DROP TABLE IF EXISTS public.campaigns;

