-- Note: This migration removes old token balance tables.
-- Restoring them would require recreating the tables and triggers,
-- which is not recommended as they are being replaced by blockchain-based tracking.
-- If restoration is needed, refer to the original migration: 1746463205275_create_token_tables

-- Recreate token_balances table
CREATE TABLE IF NOT EXISTS token_balances (
    user_id UUID PRIMARY KEY REFERENCES users(user_id),
    balance DECIMAL(20, 2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate treasury_balance table
CREATE TABLE IF NOT EXISTS treasury_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance DECIMAL(20, 2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial treasury balance
INSERT INTO treasury_balance (balance) VALUES (0) ON CONFLICT DO NOTHING;

-- Recreate update_token_balance function
CREATE OR REPLACE FUNCTION update_token_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update token_balances for from_user_id
    IF NEW.from_user_id IS NOT NULL THEN
        INSERT INTO token_balances (user_id, balance, last_updated)
        VALUES (NEW.from_user_id, 0, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET balance = token_balances.balance - NEW.amount,
            last_updated = NOW();
    END IF;
    
    -- Update token_balances for to_user_id
    IF NEW.to_user_id IS NOT NULL THEN
        INSERT INTO token_balances (user_id, balance, last_updated)
        VALUES (NEW.to_user_id, 0, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET balance = token_balances.balance + NEW.amount,
            last_updated = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW EXECUTE FUNCTION update_token_balance();

