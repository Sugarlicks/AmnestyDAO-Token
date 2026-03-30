-- Remove trigger and function that do nothing
-- The update_token_balance() function was kept for backward compatibility but is now a no-op
-- Balances are tracked on-chain via Cardano blockchain, no database balance tracking needed

DROP TRIGGER IF EXISTS token_transaction_trigger ON token_transactions;
DROP FUNCTION IF EXISTS update_token_balance();

