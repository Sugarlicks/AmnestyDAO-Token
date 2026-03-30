#!/bin/bash

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

# Function to check if Hasura is healthy
wait_for_hasura() {
    echo "Waiting for Hasura to be ready..."
    max_attempts=30
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f -H "X-Hasura-Admin-Secret: ${HASURA_ADMIN_SECRET}" http://localhost:8080/healthz > /dev/null 2>&1; then
            echo "Hasura is ready!"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts: Hasura is not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo "Error: Hasura failed to become ready after $max_attempts attempts"
    return 1
}

echo "Pulling latest images..."
docker compose pull

echo "Building containers..."
docker compose build

echo "Stopping existing containers..."
docker compose down

echo "Starting containers..."
docker compose up -d

# Wait for Hasura to be healthy
wait_for_hasura

# Install Hasura CLI if not already installed
if ! command -v hasura &> /dev/null; then
    echo "Installing Hasura CLI..."
    curl -L https://github.com/hasura/graphql-engine/raw/stable/cli/get.sh | bash
fi

# Create or update Hasura CLI config
cd hasura

echo "Applying Hasura migrations..."
hasura migrate apply --database-name default --admin-secret "${HASURA_ADMIN_SECRET}"

echo "Applying Hasura metadata..."
hasura metadata apply --admin-secret "${HASURA_ADMIN_SECRET}"

echo "Deployment complete!"