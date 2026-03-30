#!/bin/bash
# Script to diagnose and fix the contribution_type constraint issue

echo "=== Diagnosing contribution_type constraint issue ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

echo "1. Checking current constraint definition..."
echo "-------------------------------------------"
run_sql <<'EOF'
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contributions'::regclass
  AND conname LIKE '%contribution_type%';
EOF

echo ""
echo "2. Checking constraint source (table vs column level)..."
echo "-------------------------------------------"
run_sql <<'EOF'
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition,
    CASE 
        WHEN contype = 'c' THEN 'CHECK constraint'
        WHEN contype = 'p' THEN 'PRIMARY KEY'
        WHEN contype = 'f' THEN 'FOREIGN KEY'
        WHEN contype = 'u' THEN 'UNIQUE'
        ELSE 'Other'
    END AS constraint_type_name
FROM pg_constraint
WHERE conrelid = 'public.contributions'::regclass
  AND (conname LIKE '%contribution_type%' OR pg_get_constraintdef(oid) LIKE '%contribution_type%');
EOF

echo ""
echo "3. Checking column definition..."
echo "-------------------------------------------"
run_sql <<'EOF'
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contributions'
  AND column_name = 'contribution_type';
EOF

echo ""
echo "4. Checking sample contribution_type values..."
echo "-------------------------------------------"
run_sql <<'EOF'
SELECT DISTINCT contribution_type, COUNT(*) as count
FROM public.contributions
GROUP BY contribution_type
ORDER BY contribution_type;
EOF

echo ""
echo "5. Testing constraint with 'visit' value..."
echo "-------------------------------------------"
run_sql <<'EOF'
DO $$
BEGIN
    -- Try to insert a test value
    BEGIN
        INSERT INTO public.contributions (
            title, description, contribution_type, token_reward, created_by
        ) VALUES (
            'TEST_CONSTRAINT_CHECK', 'Test', 'visit', 0, gen_random_uuid()
        );
        ROLLBACK;
        RAISE NOTICE 'SUCCESS: Constraint allows ''visit''';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'FAILED: Constraint rejects ''visit'' - %', SQLERRM;
        WHEN OTHERS THEN
            RAISE NOTICE 'ERROR: %', SQLERRM;
    END;
END $$;
EOF

echo ""
echo "=== Diagnosis complete ==="
echo ""
echo "If the constraint shows old values (petition, article, event, other),"
echo "run the fix script: ./backend/scripts/fix-contribution-constraint.sh"

