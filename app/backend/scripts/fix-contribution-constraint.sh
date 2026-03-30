#!/bin/bash
# Script to fix the contribution_type constraint on the server

echo "=== Fixing contribution_type constraint ==="
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

echo -e "${YELLOW}WARNING: This will modify your database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Dropping existing constraint(s)..."
echo "-------------------------------------------"
run_sql <<'EOF'
-- Drop all possible constraint names
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find all constraints related to contribution_type
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.contributions'::regclass
          AND (conname LIKE '%contribution_type%' 
               OR pg_get_constraintdef(oid) LIKE '%contribution_type%')
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS %I', constraint_name);
            RAISE NOTICE 'Dropped constraint: %', constraint_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not drop constraint %: %', constraint_name, SQLERRM;
        END;
    END LOOP;
END $$;
EOF

echo ""
echo "Step 2: Updating existing records with invalid values..."
echo "-------------------------------------------"
run_sql <<'EOF'
UPDATE public.contributions 
SET contribution_type = CASE 
    WHEN contribution_type NOT IN ('visit', 'share', 'scan') THEN 'visit'
    ELSE contribution_type
END
WHERE contribution_type NOT IN ('visit', 'share', 'scan') OR contribution_type IS NULL;

-- Ensure no NULL values
UPDATE public.contributions 
SET contribution_type = 'visit'
WHERE contribution_type IS NULL;

SELECT 'Updated ' || COUNT(*) || ' rows' as result
FROM public.contributions
WHERE contribution_type NOT IN ('visit', 'share', 'scan');
EOF

echo ""
echo "Step 3: Adding the correct constraint..."
echo "-------------------------------------------"
run_sql <<'EOF'
ALTER TABLE public.contributions 
ADD CONSTRAINT contributions_contribution_type_check 
CHECK (contribution_type IN ('visit', 'share', 'scan'));

SELECT 'Constraint added successfully' as result;
EOF

echo ""
echo "Step 4: Verifying constraint..."
echo "-------------------------------------------"
run_sql <<'EOF'
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contributions'::regclass
  AND conname = 'contributions_contribution_type_check';
EOF

echo ""
echo "Step 5: Testing with 'visit' value..."
echo "-------------------------------------------"
run_sql <<'EOF'
DO $$
BEGIN
    BEGIN
        INSERT INTO public.contributions (
            title, description, contribution_type, token_reward, created_by
        ) VALUES (
            'TEST_CONSTRAINT_FIX', 'Test after fix', 'visit', 0, gen_random_uuid()
        );
        DELETE FROM public.contributions WHERE title = 'TEST_CONSTRAINT_FIX';
        RAISE NOTICE 'SUCCESS: Constraint now allows ''visit''';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'FAILED: Constraint still rejects ''visit'' - %', SQLERRM;
        WHEN OTHERS THEN
            RAISE NOTICE 'ERROR: %', SQLERRM;
    END;
END $$;
EOF

echo ""
echo -e "${GREEN}=== Fix complete ===${NC}"
echo ""
echo "The constraint should now allow: 'visit', 'share', 'scan'"
echo "Try creating a contribution again."

