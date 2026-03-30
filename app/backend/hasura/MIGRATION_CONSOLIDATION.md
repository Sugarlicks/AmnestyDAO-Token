# Hasura Migration Consolidation

## Overview

For initial deployments, all incremental migrations have been consolidated into a single initial migration (`00000000000000_init`). This simplifies deployment and ensures a clean database schema from the start.

## What Changed

### Before
- 19 separate migration files tracking incremental schema changes
- Each migration represented a single change or set of related changes
- Migrations needed to be applied in chronological order

### After
- 1 consolidated migration file (`00000000000000_init/up.sql`)
- Contains the final state of the entire database schema
- All tables, functions, triggers, indexes, and constraints in one place

## Final Schema Summary

The consolidated migration includes:

### Tables
1. **users** - User accounts with authentication and profile data
2. **chats** - Chat rooms/groups
3. **chat_participants** - Many-to-many relationship between users and chats
4. **chat_read_timestamps** - Tracks when users last read messages in chats
5. **memberships** - User roles within chats
6. **messages** - Chat messages
7. **contributions** - User contribution opportunities (visit, share, scan)
8. **user_contributions** - Tracks completed contributions by users
9. **campaigns** - Campaign information
10. **campaign_donations** - User donations to campaigns
11. **token_transactions** - Token transaction records (on-chain tracking)
12. **user_notification_tokens** - Push notification tokens

### Key Design Decisions

1. **Image Storage**: 
   - `users.profile_image`: TEXT (base64)
   - `contributions.image_data`: TEXT (base64)
   - `campaigns.image_data`: TEXT (base64)
   - `chats.image`: BYTEA (kept as bytea per final migration)

2. **Token Balances**: 
   - No `token_balances` or `treasury_balance` tables
   - Balances are tracked on-chain via Cardano blockchain
   - `update_token_balance()` function removed (was a no-op)

3. **Transaction Types**: 
   - Uses `transaction_type` column (not `type`)
   - Valid values: 'TRANSFER', 'TREASURY_DEPOSIT', 'TREASURY_WITHDRAWAL', 'REWARD', 'DONATION'
   - `amount` column is nullable (uses `token_amount` when available)

4. **Contribution Types**: 
   - Valid values: 'visit', 'share', 'scan'
   - (Old values 'petition', 'article', 'event', 'other' were migrated)

## How to Use

### For Initial Deployment

Simply apply the single migration:

```bash
cd hasura
hasura migrate apply --database-name default --admin-secret <your-secret>
```

### For Existing Deployments

⚠️ **Warning**: If you have an existing database with data, DO NOT use the consolidated migration. Instead:

1. Keep your existing migrations
2. Only use consolidated migrations for fresh deployments
3. For production updates, continue using incremental migrations

### Rolling Back

If you need to rollback the initial migration:

```bash
cd hasura
hasura migrate apply --database-name default --down 1 --admin-secret <your-secret>
```

Or manually run the `down.sql` file.

## Migration Consolidation Script

A helper script is available to consolidate migrations:

```bash
./scripts/consolidate-migrations.sh
```

This script:
1. Backs up existing migrations
2. Removes old migration directories
3. Keeps only the consolidated initial migration

## Verification

After applying the migration, verify the schema:

```bash
# Check migration status
hasura migrate status --database-name default --admin-secret <your-secret>

# Or connect to PostgreSQL and verify tables
psql -U <user> -d <database> -c "\dt"
```

## Benefits

1. **Simpler Deployment**: One migration instead of 19
2. **Faster Setup**: Single transaction instead of multiple
3. **Clearer Schema**: See entire schema in one file
4. **Easier Onboarding**: New developers see final state immediately
5. **Reduced Complexity**: No need to understand migration history

## Migration History

The consolidated migration represents the final state after these migrations were applied:

- `1746463205273_init` - Initial tables and functions
- `1746463205274_add_chat_read_timestamps` - Chat read tracking
- `1746463205275_create_token_tables` - Token tables (later removed)
- `1747401976699_update_treasury_balance_trigger` - Treasury triggers
- `1747416181335_fix_treasury_withdrawal_trigger` - Treasury fixes
- `1749000000000_add_login_nonce_and_user_data` - Auth fields
- `1749500000000_add_email_to_users` - Email field
- `1750000000000_create_contributions` - Contributions system
- `1751000000000_create_campaigns` - Campaigns system
- `1752000000000_update_token_transactions` - Enhanced transactions
- `1753000000000_remove_old_token_tables` - Removed balance tables
- `1754000000000_make_amount_nullable` - Made amount nullable
- `1755000000000_consolidate_transaction_type` - Consolidated types
- `1756000000000_fix_update_token_balance_function` - Function fixes
- `1757000000000_update_contribution_types` - Updated contribution types
- `1758000000000_fix_token_balance_function_manual` - Manual fixes
- `1759000000000_convert_image_data_to_text` - Image format changes
- `20240321000000_create_user_notification_tokens` - Notification tokens
- `20240321000001_update_chat_image_type` - Chat image type
- `20240321000002_remove_update_token_balance_trigger` - Removed trigger

All of these changes are now represented in the single consolidated migration.

