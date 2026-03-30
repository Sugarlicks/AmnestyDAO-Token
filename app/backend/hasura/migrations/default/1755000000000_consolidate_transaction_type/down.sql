-- Rollback: Restore type column and revert transaction_type changes

-- Step 1: Add back type column
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('TRANSFER', 'TREASURY_DEPOSIT', 'TREASURY_WITHDRAWAL', 'REWARD'));

-- Step 2: Migrate data back from transaction_type to type
UPDATE token_transactions
SET type = transaction_type
WHERE type IS NULL AND transaction_type IS NOT NULL 
  AND transaction_type IN ('TRANSFER', 'TREASURY_DEPOSIT', 'TREASURY_WITHDRAWAL', 'REWARD');

-- Step 3: Make type NOT NULL
ALTER TABLE token_transactions
  ALTER COLUMN type SET NOT NULL;

-- Step 4: Revert transaction_type constraint to original values
ALTER TABLE token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check 
  CHECK (transaction_type IN ('REWARD', 'DONATION'));

-- Step 5: Make transaction_type nullable again
ALTER TABLE token_transactions
  ALTER COLUMN transaction_type DROP NOT NULL;

-- Step 6: Revert trigger function to use type
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

