#!/bin/bash
# Script to fix the type column in token_transactions table
# This removes the NOT NULL constraint and optionally drops the column

echo "=== Fixing token_transactions type column ==="
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

# Check if type column exists
echo "Checking current state of token_transactions table..."
echo "-------------------------------------------"
run_sql <<'EOF'
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'token_transactions'
  AND column_name IN ('type', 'transaction_type')
ORDER BY column_name;
EOF

echo ""
echo -e "${YELLOW}WARNING: This will modify your database!${NC}"
echo ""
echo "Choose an option:"
echo "  1) Quick fix: Remove NOT NULL constraint from 'type' column (allows NULLs)"
echo "  2) Complete fix: Migrate data and drop 'type' column entirely (recommended)"
echo ""
read -p "Enter option (1 or 2): " option

if [ "$option" != "1" ] && [ "$option" != "2" ]; then
    echo -e "${RED}Invalid option. Aborted.${NC}"
    exit 1
fi

read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

if [ "$option" == "1" ]; then
    echo ""
    echo "Step 1: Removing NOT NULL constraint from 'type' column..."
    echo "-------------------------------------------"
    run_sql <<'EOF'
ALTER TABLE token_transactions
  ALTER COLUMN type DROP NOT NULL;

SELECT 'NOT NULL constraint removed from type column' as result;
EOF

    echo ""
    echo -e "${GREEN}=== Quick fix complete ===${NC}"
    echo ""
    echo "The 'type' column can now be NULL, which should fix the immediate error."
    echo "However, you should still run the complete fix (option 2) or apply the migration"
    echo "to fully remove the 'type' column."
    
elif [ "$option" == "2" ]; then
    echo ""
    echo "Step 1: Migrating data from 'type' to 'transaction_type'..."
    echo "-------------------------------------------"
    run_sql <<'EOF'
-- Migrate any data from type to transaction_type where transaction_type is NULL
UPDATE token_transactions
SET transaction_type = type
WHERE transaction_type IS NULL AND type IS NOT NULL;

SELECT 
    'Migrated ' || COUNT(*) || ' rows from type to transaction_type' as result
FROM token_transactions
WHERE transaction_type IS NOT NULL AND type IS NOT NULL;
EOF

    echo ""
    echo "Step 2: Ensuring transaction_type is NOT NULL..."
    echo "-------------------------------------------"
    run_sql <<'EOF'
-- Make sure transaction_type is NOT NULL
ALTER TABLE token_transactions
  ALTER COLUMN transaction_type SET NOT NULL;

SELECT 'transaction_type is now NOT NULL' as result;
EOF

    echo ""
    echo "Step 3: Dropping the 'type' column..."
    echo "-------------------------------------------"
    run_sql <<'EOF'
ALTER TABLE token_transactions
  DROP COLUMN IF EXISTS type;

SELECT 'type column dropped successfully' as result;
EOF

    echo ""
    echo "Step 4: Verifying the fix..."
    echo "-------------------------------------------"
    run_sql <<'EOF'
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'token_transactions'
  AND column_name IN ('type', 'transaction_type')
ORDER BY column_name;
EOF

    echo ""
    echo -e "${GREEN}=== Complete fix applied ===${NC}"
    echo ""
    echo "The 'type' column has been removed. Your database now only uses 'transaction_type'."
    echo "The error should be resolved."
fi

echo ""

