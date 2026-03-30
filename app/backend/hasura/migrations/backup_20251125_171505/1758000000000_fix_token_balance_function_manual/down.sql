-- Rollback: This migration fixes a function, so rollback would restore the broken function
-- We'll just drop and recreate with the same no-op function for consistency

DROP TRIGGER IF EXISTS token_transaction_trigger ON token_transactions;
DROP FUNCTION IF EXISTS update_token_balance();

CREATE OR REPLACE FUNCTION update_token_balance()
RETURNS TRIGGER AS $$
BEGIN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_token_balance();

