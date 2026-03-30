-- Remove indexes
DROP INDEX IF EXISTS idx_token_transactions_campaign_id;
DROP INDEX IF EXISTS idx_token_transactions_contribution_id;
DROP INDEX IF EXISTS idx_token_transactions_to_wallet;
DROP INDEX IF EXISTS idx_token_transactions_from_wallet;
DROP INDEX IF EXISTS idx_token_transactions_status;
DROP INDEX IF EXISTS idx_token_transactions_user_id;
DROP INDEX IF EXISTS idx_token_transactions_cardano_tx_hash;

-- Remove columns
ALTER TABLE token_transactions
  DROP COLUMN IF EXISTS error_message,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS transaction_status,
  DROP COLUMN IF EXISTS campaign_id,
  DROP COLUMN IF EXISTS contribution_id,
  DROP COLUMN IF EXISTS token_amount,
  DROP COLUMN IF EXISTS to_wallet_address,
  DROP COLUMN IF EXISTS from_wallet_address,
  DROP COLUMN IF EXISTS cardano_tx_hash,
  DROP COLUMN IF EXISTS transaction_type,
  DROP COLUMN IF EXISTS user_id;


