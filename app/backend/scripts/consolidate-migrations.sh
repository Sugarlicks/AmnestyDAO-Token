#!/bin/bash

# Script to consolidate Hasura migrations into a single initial migration
# This is safe for initial deployments where no production data exists

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the backend directory (parent of scripts directory)
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Set paths relative to backend directory
MIGRATIONS_DIR="$BACKEND_DIR/hasura/migrations/default"
BACKUP_DIR="$BACKEND_DIR/hasura/migrations/backup_$(date +%Y%m%d_%H%M%S)"

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory not found at $MIGRATIONS_DIR"
    exit 1
fi

# Check if consolidated migration exists
if [ ! -d "$MIGRATIONS_DIR/00000000000000_init" ]; then
    echo "Error: Consolidated migration not found at $MIGRATIONS_DIR/00000000000000_init"
    echo "Please create the consolidated migration first."
    exit 1
fi

echo "=========================================="
echo "Hasura Migration Consolidation Script"
echo "=========================================="
echo ""
echo "Backend directory: $BACKEND_DIR"
echo "Migrations directory: $MIGRATIONS_DIR"
echo ""
echo "This script will:"
echo "1. Backup existing migrations to: $BACKUP_DIR"
echo "2. Remove all old migration directories"
echo "3. Keep only the consolidated initial migration: 00000000000000_init"
echo ""

# Count old migrations
OLD_MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d ! -name "00000000000000_init" | wc -l | tr -d ' ')
echo "Found $OLD_MIGRATION_COUNT old migration(s) to remove"
echo ""

# Check for non-interactive mode (if YES environment variable is set)
if [ "${YES:-}" = "1" ] || [ "${FORCE:-}" = "1" ]; then
    REPLY="y"
else
    read -p "Continue? (y/N) " -n 1 -r
    echo ""
fi

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Change to backend directory to ensure relative paths work
cd "$BACKEND_DIR"

# Create backup directory
echo "Creating backup..."
mkdir -p "$BACKUP_DIR"
cp -r "$MIGRATIONS_DIR"/* "$BACKUP_DIR/" 2>/dev/null || true
echo "✓ Backup created at: $BACKUP_DIR"

# List all migrations except the new init one
echo ""
echo "Removing old migrations..."
REMOVED_COUNT=0
for dir in "$MIGRATIONS_DIR"/*; do
    if [ -d "$dir" ] && [ "$(basename "$dir")" != "00000000000000_init" ]; then
        echo "  Removing: $(basename "$dir")"
        rm -rf "$dir"
        REMOVED_COUNT=$((REMOVED_COUNT + 1))
    fi
done

echo ""
echo "Removed $REMOVED_COUNT migration(s)"
echo ""
echo "=========================================="
echo "Migration consolidation complete!"
echo "=========================================="
echo ""
echo "Remaining migrations:"
ls -1 "$MIGRATIONS_DIR"
echo ""
echo "To apply the consolidated migration:"
echo "  cd hasura"
echo "  hasura migrate apply --database-name default --admin-secret <your-secret>"
echo ""
echo "Backup location: $BACKUP_DIR"

