#!/bin/bash
# Script to fix the update_token_balance() function to remove treasury_balance references
# This fixes the error: relation "treasury_balance" does not exist

echo "=== Fixing update_token_balance() function ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Find project root (where docker-compose.yml might be)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."
cd "$PROJECT_ROOT" 2>/dev/null || true

# Try to find Docker containers
DB_CONTAINER=""
DOCKER_COMPOSE_CMD=""

# Check for docker-compose.yml in current or parent directories
if [ -f "docker-compose.yml" ] || [ -f "../docker-compose.yml" ] || [ -f "../../docker-compose.yml" ]; then
    DOCKER_COMPOSE_FILE=$(find . .. ../.. -maxdepth 1 -name "docker-compose.yml" 2>/dev/null | head -1)
    if [ -n "$DOCKER_COMPOSE_FILE" ]; then
        DOCKER_COMPOSE_DIR=$(dirname "$DOCKER_COMPOSE_FILE")
        echo -e "${YELLOW}Found docker-compose.yml at: $DOCKER_COMPOSE_FILE${NC}"
        
        # Try docker-compose (v2)
        if command -v docker-compose &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker-compose"
        elif docker compose version &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker compose"
        fi
        
        if [ -n "$DOCKER_COMPOSE_CMD" ]; then
            cd "$DOCKER_COMPOSE_DIR"
            DB_CONTAINER=$($DOCKER_COMPOSE_CMD ps -q postgres 2>/dev/null || \
                          $DOCKER_COMPOSE_CMD ps -q db 2>/dev/null || echo "")
            cd "$PROJECT_ROOT"
        fi
    fi
fi

# If no container found via docker-compose, try docker ps directly
if [ -z "$DB_CONTAINER" ]; then
    DB_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.ID}}" 2>/dev/null | head -1)
    if [ -z "$DB_CONTAINER" ]; then
        DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.ID}}" 2>/dev/null | head -1)
    fi
    if [ -z "$DB_CONTAINER" ]; then
        # Try to find any postgres container
        DB_CONTAINER=$(docker ps --filter "ancestor=postgres" --format "{{.ID}}" 2>/dev/null | head -1)
    fi
fi

# Set up run_sql function
if [ -n "$DB_CONTAINER" ]; then
    echo -e "${YELLOW}Detected Docker environment${NC}"
    echo "Using container: $DB_CONTAINER"
    
    # Try to get database credentials from container environment
    # First try to read from the container's actual environment
    POSTGRES_USER=$(docker exec "$DB_CONTAINER" printenv POSTGRES_USER 2>/dev/null | head -1 || echo "")
    POSTGRES_DB=$(docker exec "$DB_CONTAINER" printenv POSTGRES_DB 2>/dev/null | head -1 || echo "")
    
    # If not found in container, try from .env file in project root or backend directory
    if [ -z "$POSTGRES_USER" ]; then
        if [ -f "$PROJECT_ROOT/.env" ]; then
            POSTGRES_USER=$(grep "^POSTGRES_USER=" "$PROJECT_ROOT/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
        elif [ -f "$PROJECT_ROOT/backend/.env" ]; then
            POSTGRES_USER=$(grep "^POSTGRES_USER=" "$PROJECT_ROOT/backend/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
        fi
    fi
    if [ -z "$POSTGRES_DB" ]; then
        if [ -f "$PROJECT_ROOT/.env" ]; then
            POSTGRES_DB=$(grep "^POSTGRES_DB=" "$PROJECT_ROOT/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
        elif [ -f "$PROJECT_ROOT/backend/.env" ]; then
            POSTGRES_DB=$(grep "^POSTGRES_DB=" "$PROJECT_ROOT/backend/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
        fi
    fi
    
    # Defaults if still not found
    POSTGRES_USER=${POSTGRES_USER:-hrdao}
    POSTGRES_DB=${POSTGRES_DB:-hrdao_db}
    
    echo "Database user: $POSTGRES_USER"
    echo "Database name: $POSTGRES_DB"
    echo ""
    
    # Function to run SQL in container
    run_sql() {
        if [ -n "$DOCKER_COMPOSE_CMD" ] && [ -n "$DOCKER_COMPOSE_DIR" ]; then
            cd "$DOCKER_COMPOSE_DIR"
            $DOCKER_COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>/dev/null || \
            $DOCKER_COMPOSE_CMD exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>/dev/null || \
            docker exec -i "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
            cd "$PROJECT_ROOT"
        else
            # Try the detected user first, then fallback to common usernames
            # Try multiple database names too
            docker exec -i "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>/dev/null || \
            docker exec -i "$DB_CONTAINER" psql -U hrdao -d hrdao_db 2>/dev/null || \
            docker exec -i "$DB_CONTAINER" psql -U hrdao -d postgres 2>/dev/null || \
            docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres 2>/dev/null || \
            docker exec -i "$DB_CONTAINER" psql -U postgres -d hrdao_db 2>/dev/null
        fi
    }
elif command -v psql &> /dev/null; then
    echo -e "${YELLOW}Using direct psql connection${NC}"
    echo "Using default PostgreSQL connection"
    echo ""
    
    run_sql() {
        psql "$@"
    }
else
    echo -e "${RED}Error: Could not find PostgreSQL connection${NC}"
    echo "Please ensure:"
    echo "  1. Docker containers are running, OR"
    echo "  2. psql is installed and PGHOST, PGPORT, PGDATABASE, PGUSER are set"
    exit 1
fi

# Check current function definition
echo "Checking current state of update_token_balance() function..."
echo "-------------------------------------------"
run_sql <<'EOF'
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'update_token_balance';
EOF

echo ""
echo -e "${YELLOW}WARNING: This will modify your database!${NC}"
echo ""
echo "This script will:"
echo "  1. Drop the existing update_token_balance() function"
echo "  2. Recreate it without any references to treasury_balance or token_balances tables"
echo "  3. Recreate the trigger that uses this function"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Dropping existing trigger and function..."
echo "-------------------------------------------"
run_sql <<'EOF'
DROP TRIGGER IF EXISTS token_transaction_trigger ON token_transactions;
DROP FUNCTION IF EXISTS update_token_balance();

SELECT 'Trigger and function dropped successfully' as result;
EOF

echo ""
echo "Step 2: Creating updated function without treasury_balance references..."
echo "-------------------------------------------"
run_sql <<'EOF'
-- Create updated function that does nothing (balances are tracked on-chain)
-- We keep the function and trigger for backward compatibility in case other code depends on them
CREATE OR REPLACE FUNCTION update_token_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Balances are now tracked on-chain via Cardano blockchain
    -- No database balance tracking needed
    -- This function exists only to maintain trigger compatibility
    -- The treasury_balance and token_balances tables were removed in migration 1753000000000
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SELECT 'Function created successfully' as result;
EOF

echo ""
echo "Step 3: Recreating trigger..."
echo "-------------------------------------------"
run_sql <<'EOF'
-- Recreate trigger (kept for backward compatibility)
CREATE TRIGGER token_transaction_trigger
AFTER INSERT ON token_transactions
FOR EACH ROW
EXECUTE FUNCTION update_token_balance();

SELECT 'Trigger created successfully' as result;
EOF

echo ""
echo "Step 4: Verifying the fix..."
echo "-------------------------------------------"
run_sql <<'EOF'
-- Check that the function exists and doesn't reference treasury_balance
SELECT 
    p.proname as function_name,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%treasury_balance%' THEN 'ERROR: Still references treasury_balance!'
        WHEN pg_get_functiondef(p.oid) LIKE '%token_balances%' THEN 'ERROR: Still references token_balances!'
        ELSE 'OK: Function does not reference removed tables'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'update_token_balance';

-- Check that the trigger exists
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'token_transaction_trigger';
EOF

echo ""
echo -e "${GREEN}=== Fix complete ===${NC}"
echo ""
echo "The update_token_balance() function has been updated to remove all references"
echo "to the treasury_balance and token_balances tables. The function is now a no-op"
echo "since balances are tracked on-chain via the Cardano blockchain."
echo ""
echo "The error 'relation treasury_balance does not exist' should now be resolved."
echo ""

