#!/bin/bash

# Script to check migration status and diagnose migration issues

set -e

# Load environment variables from .env file
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    set -a
    source .env
    set +a
else
    echo ".env file not found! Exiting."
    exit 1
fi

# Default endpoint (can be overridden)
HASURA_ENDPOINT="${HASURA_ENDPOINT:-http://localhost:8080}"

echo "=========================================="
echo "Migration Status Check"
echo "=========================================="
echo ""
echo "Hasura Endpoint: $HASURA_ENDPOINT"
echo ""

# Check if Hasura is accessible
echo "1. Checking Hasura connectivity..."
if curl -s -f -H "X-Hasura-Admin-Secret: ${HASURA_ADMIN_SECRET}" "$HASURA_ENDPOINT/healthz" > /dev/null 2>&1; then
    echo "   ✓ Hasura is accessible"
else
    echo "   ✗ Cannot connect to Hasura at $HASURA_ENDPOINT"
    echo "   Make sure Hasura is running and accessible"
    exit 1
fi

# Install Hasura CLI if not already installed
if ! command -v hasura &> /dev/null; then
    echo ""
    echo "2. Installing Hasura CLI..."
    curl -L https://github.com/hasura/graphql-engine/raw/stable/cli/get.sh | bash
    export PATH="$PATH:$HOME/.hasura"
else
    echo ""
    echo "2. Hasura CLI is installed"
fi

# Change to hasura directory
cd hasura

echo ""
echo "3. Checking migration status..."
echo ""

# Check migration status
hasura migrate status --database-name default \
    --endpoint "$HASURA_ENDPOINT" \
    --admin-secret "${HASURA_ADMIN_SECRET}" || {
    echo ""
    echo "Error checking migration status. This might indicate:"
    echo "  - Migrations table doesn't exist"
    echo "  - Connection issues"
    echo "  - Invalid endpoint"
    exit 1
}

echo ""
echo "=========================================="
echo "Migration Check Complete"
echo "=========================================="
echo ""
echo "To apply pending migrations, run:"
echo "  cd hasura"
echo "  hasura migrate apply --database-name default --endpoint $HASURA_ENDPOINT --admin-secret <your-secret>"
echo ""


