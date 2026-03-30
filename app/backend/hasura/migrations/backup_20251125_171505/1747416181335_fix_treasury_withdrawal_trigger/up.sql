-- Drop existing trigger and function
DROP TRIGGER IF EXISTS token_transaction_trigger ON token_transactions;
DROP FUNCTION IF EXISTS update_token_balance();

-- Create updated function
CREATE OR REPLACE FUNCTION update_token_balance()
RETURNS TRIGGER AS $$
DECLARE
    current_balance DECIMAL(20, 2);
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

    -- Update receiver's balance only for non-treasury transactions
    IF NEW.to_user_id IS NOT NULL AND NEW.type != 'TREASURY_WITHDRAWAL' THEN
        -- Insert or update receiver's balance
        INSERT INTO token_balances (user_id, balance)
        VALUES (NEW.to_user_id, NEW.amount)
        ON CONFLICT (user_id) DO UPDATE
        SET balance = token_balances.balance + NEW.amount,
            last_updated = NOW();
    END IF;

    -- Get current treasury balance
    SELECT balance INTO current_balance
    FROM treasury_balance
    ORDER BY created_at DESC
    LIMIT 1;

    -- Update treasury balance
    IF NEW.type = 'TREASURY_DEPOSIT' THEN
        INSERT INTO treasury_balance (balance)
        VALUES (COALESCE(current_balance, 0) + NEW.amount);
    ELSIF NEW.type = 'TREASURY_WITHDRAWAL' THEN
        INSERT INTO treasury_balance (balance)
        VALUES (COALESCE(current_balance, 0) - NEW.amount);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_token_balance();
