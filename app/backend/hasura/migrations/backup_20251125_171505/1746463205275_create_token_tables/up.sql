-- Drop trigger if it exists
DROP TRIGGER IF EXISTS token_transaction_trigger ON token_transactions;

-- Drop function if it exists
DROP FUNCTION IF EXISTS update_token_balance();

-- Create token_balances table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'token_balances') THEN
        CREATE TABLE token_balances (
            user_id UUID PRIMARY KEY REFERENCES users(user_id),
            balance DECIMAL(20, 2) NOT NULL DEFAULT 0,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Create token_transactions table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'token_transactions') THEN
        CREATE TABLE token_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            from_user_id UUID REFERENCES users(user_id),
            to_user_id UUID REFERENCES users(user_id),
            amount DECIMAL(20, 2) NOT NULL,
            description TEXT,
            type TEXT NOT NULL CHECK (type IN ('TRANSFER', 'TREASURY_DEPOSIT', 'TREASURY_WITHDRAWAL', 'REWARD')),
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Create treasury_balance table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'treasury_balance') THEN
        CREATE TABLE treasury_balance (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            balance DECIMAL(20, 2) NOT NULL DEFAULT 0,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Insert initial treasury balance
        INSERT INTO treasury_balance (balance) VALUES (0);
    END IF;
END $$;

-- Create indexes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_token_transactions_from_user_id') THEN
        CREATE INDEX idx_token_transactions_from_user_id ON token_transactions(from_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_token_transactions_to_user_id') THEN
        CREATE INDEX idx_token_transactions_to_user_id ON token_transactions(to_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_token_transactions_timestamp') THEN
        CREATE INDEX idx_token_transactions_timestamp ON token_transactions(timestamp);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_treasury_balance_created_at') THEN
        CREATE INDEX idx_treasury_balance_created_at ON treasury_balance(created_at DESC);
    END IF;
END $$;

-- Create function to update balance after transaction
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

-- Create trigger for balance updates
CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_token_balance(); 