-- Add new columns to token_transactions
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS transaction_type TEXT CHECK (transaction_type IN ('REWARD', 'DONATION')),
  ADD COLUMN IF NOT EXISTS cardano_tx_hash TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS from_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS to_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS token_amount DECIMAL(20, 2),
  ADD COLUMN IF NOT EXISTS contribution_id UUID REFERENCES contributions(id),
  ADD COLUMN IF NOT EXISTS campaign_id UUID,
  ADD COLUMN IF NOT EXISTS transaction_status TEXT CHECK (transaction_status IN ('PENDING', 'CONFIRMED', 'FAILED')) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_token_transactions_cardano_tx_hash ON token_transactions(cardano_tx_hash);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_status ON token_transactions(transaction_status);
CREATE INDEX IF NOT EXISTS idx_token_transactions_from_wallet ON token_transactions(from_wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_transactions_to_wallet ON token_transactions(to_wallet_address);
CREATE INDEX IF NOT EXISTS idx_token_transactions_contribution_id ON token_transactions(contribution_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_campaign_id ON token_transactions(campaign_id);

-- Backfill user_id from from_user_id or to_user_id (only if there are existing transactions)
-- Note: Skip this if you don't have any existing transactions in the database
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM token_transactions LIMIT 1) THEN
    UPDATE token_transactions
    SET user_id = COALESCE(from_user_id, to_user_id)
    WHERE user_id IS NULL;
    
    -- Backfill wallet addresses from users table
    UPDATE token_transactions tx
    SET from_wallet_address = u.public_key
    FROM users u
    WHERE tx.from_user_id = u.user_id AND tx.from_wallet_address IS NULL;
    
    UPDATE token_transactions tx
    SET to_wallet_address = u.public_key
    FROM users u
    WHERE tx.to_user_id = u.user_id AND tx.to_wallet_address IS NULL;
    
    -- Set old transactions as confirmed
    UPDATE token_transactions
    SET transaction_status = 'CONFIRMED',
        confirmed_at = timestamp
    WHERE (transaction_status IS NULL OR transaction_status = 'PENDING')
      AND timestamp < NOW() - INTERVAL '1 hour';
  END IF;
END $$;

