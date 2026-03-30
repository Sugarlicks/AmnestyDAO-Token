-- Consolidate type and transaction_type columns into transaction_type
-- Step 1: Expand transaction_type to include all transaction types
ALTER TABLE token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check 
  CHECK (transaction_type IN ('TRANSFER', 'TREASURY_DEPOSIT', 'TREASURY_WITHDRAWAL', 'REWARD', 'DONATION'));

-- Step 2: Migrate data from type to transaction_type where transaction_type is NULL
-- Only migrate if type column exists and has data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'token_transactions' AND column_name = 'type'
  ) THEN
    UPDATE token_transactions
    SET transaction_type = type
    WHERE transaction_type IS NULL AND type IS NOT NULL;
  END IF;
END $$;

-- Step 3: Make transaction_type NOT NULL (after migration)
ALTER TABLE token_transactions
  ALTER COLUMN transaction_type SET NOT NULL;

-- Step 4: Update trigger function to use transaction_type instead of type
-- Note: token_balances and treasury_balance tables were removed in migration 1753000000000
-- because balances are now tracked on-chain. This function is kept for backward compatibility
-- but does not update any balance tables.
CREATE OR REPLACE FUNCTION update_token_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Balances are now tracked on-chain via Cardano blockchain
    -- No database balance tracking needed
    -- This function exists only to maintain trigger compatibility
    -- The function now uses transaction_type instead of type, but doesn't update balances
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (it was dropped in migration 1753000000000)
CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_token_balance();

-- Step 5: Drop the old type column
ALTER TABLE token_transactions
  DROP COLUMN IF EXISTS type;

