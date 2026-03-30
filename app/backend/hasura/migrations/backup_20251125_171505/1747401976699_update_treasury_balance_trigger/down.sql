-- Drop index if it exists
DROP INDEX IF EXISTS idx_treasury_balance_created_at;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS token_transaction_trigger ON token_transactions;
DROP FUNCTION IF EXISTS update_token_balance();

-- Recreate original function
CREATE OR REPLACE FUNCTION update_token_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sender's balance
    IF NEW.from_user_id IS NOT NULL THEN
        -- Insert or update sender's balance
        INSERT INTO token_balances (user_id, balance)
        VALUES (NEW.from_user_id, -NEW.amount)
        ON CONFLICT (user_id) DO UPDATE
        SET balance = token_balances.balance - NEW.amount,
            last_updated = NOW();
    END IF;

    -- Update receiver's balance
    IF NEW.to_user_id IS NOT NULL THEN
        -- Insert or update receiver's balance
        INSERT INTO token_balances (user_id, balance)
        VALUES (NEW.to_user_id, NEW.amount)
        ON CONFLICT (user_id) DO UPDATE
        SET balance = token_balances.balance + NEW.amount,
            last_updated = NOW();
    END IF;

    -- Update treasury balance
    IF NEW.type = 'TREASURY_DEPOSIT' THEN
        UPDATE treasury_balance
        SET balance = balance + NEW.amount,
            last_updated = NOW()
        WHERE id = (SELECT id FROM treasury_balance ORDER BY id DESC LIMIT 1);
    ELSIF NEW.type = 'TREASURY_WITHDRAWAL' THEN
        UPDATE treasury_balance
        SET balance = balance - NEW.amount,
            last_updated = NOW()
        WHERE id = (SELECT id FROM treasury_balance ORDER BY id DESC LIMIT 1);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_token_balance();
