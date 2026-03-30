#!/bin/bash

# Script to force Hasura to reload metadata and discover new tables from migrations

set -e

# Hasura configuration
HASURA_ADMIN_SECRET="hrdao_password"
HASURA_ENDPOINT="${HASURA_ENDPOINT:-http://localhost:8080}"

echo "=========================================="
echo "Force Reload Hasura Metadata"
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
echo "3. Applying migrations (creates/updates tables in database)..."
hasura migrate apply --database-name default \
    --endpoint "$HASURA_ENDPOINT" \
    --admin-secret "${HASURA_ADMIN_SECRET}"

echo ""
echo "4. Reloading metadata from database (discovers new tables)..."
hasura metadata reload \
    --endpoint "$HASURA_ENDPOINT" \
    --admin-secret "${HASURA_ADMIN_SECRET}"

echo ""
echo "5. Applying metadata (applies permissions, relationships, etc.)..."
hasura metadata apply \
    --endpoint "$HASURA_ENDPOINT" \
    --admin-secret "${HASURA_ADMIN_SECRET}"

echo ""
echo "=========================================="
echo "Metadata Reload Complete!"
echo "=========================================="
echo ""
echo "Hasura should now be aware of all tables from migrations."
echo "You can verify by checking the Hasura Console at:"
echo "  $HASURA_ENDPOINT/console"
echo ""

