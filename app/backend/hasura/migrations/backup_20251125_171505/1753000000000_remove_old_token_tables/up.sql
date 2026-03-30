-- Drop triggers first
DROP TRIGGER IF EXISTS token_transaction_trigger ON token_transactions;
DROP FUNCTION IF EXISTS update_token_balance();

-- Drop tables
DROP TABLE IF EXISTS treasury_balance;
DROP TABLE IF EXISTS token_balances;

