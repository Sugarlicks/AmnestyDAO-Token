-- Manual fix for update_token_balance() function
-- This ensures the function doesn't reference token_balances or treasury_balance tables
-- which were removed in migration 1753000000000

DROP TRIGGER IF EXISTS token_transaction_trigger ON token_transactions;
DROP FUNCTION IF EXISTS update_token_balance();

-- Create updated function that does nothing (balances are tracked on-chain)
CREATE OR REPLACE FUNCTION update_token_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Balances are now tracked on-chain via Cardano blockchain
    -- No database balance tracking needed
    -- This function exists only to maintain trigger compatibility
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_token_balance();

