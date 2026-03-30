-- Recreate the no-op function and trigger (for rollback purposes)
-- Note: This function does nothing - balances are tracked on-chain

CREATE OR REPLACE FUNCTION update_token_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Balances are now tracked on-chain via Cardano blockchain
    -- No database balance tracking needed
    -- This function exists only to maintain trigger compatibility
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_token_balance();

