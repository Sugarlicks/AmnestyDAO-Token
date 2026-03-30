-- Fix update_token_balance() function to remove all table references
-- Both treasury_balance and token_balances tables were removed in migration 1753000000000_remove_old_token_tables
-- because balances are now tracked on-chain. The function should be a no-op.

DROP TRIGGER IF EXISTS token_transaction_trigger ON token_transactions;
DROP FUNCTION IF EXISTS update_token_balance();

-- Create updated function that does nothing (balances are tracked on-chain)
-- We keep the function and trigger for backward compatibility in case other code depends on them
CREATE OR REPLACE FUNCTION update_token_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Balances are now tracked on-chain via Cardano blockchain
    -- No database balance tracking needed
    -- This function exists only to maintain trigger compatibility
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (kept for backward compatibility)
CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_token_balance();

