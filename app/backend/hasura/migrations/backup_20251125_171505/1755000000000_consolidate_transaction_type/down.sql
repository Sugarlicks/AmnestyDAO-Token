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
    -- Update sender's balance
    IF NEW.from_user_id IS NOT NULL THEN
        INSERT INTO token_balances (user_id, balance)
        VALUES (NEW.from_user_id, -NEW.amount)
        ON CONFLICT (user_id) DO UPDATE
        SET balance = token_balances.balance - NEW.amount,
            last_updated = NOW();
    END IF;

    -- Update receiver's balance
    IF NEW.to_user_id IS NOT NULL THEN
        INSERT INTO token_balances (user_id, balance)
        VALUES (NEW.to_user_id, NEW.amount)
        ON CONFLICT (user_id) DO UPDATE
        SET balance = token_balances.balance + NEW.amount,
            last_updated = NOW();
    END IF;

    -- Update treasury balance (using type)
    IF NEW.type = 'TREASURY_DEPOSIT' THEN
        INSERT INTO treasury_balance (balance)
        SELECT balance + NEW.amount
        FROM treasury_balance
        ORDER BY created_at DESC
        LIMIT 1;
    ELSIF NEW.type = 'TREASURY_WITHDRAWAL' THEN
        INSERT INTO treasury_balance (balance)
        SELECT balance - NEW.amount
        FROM treasury_balance
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

