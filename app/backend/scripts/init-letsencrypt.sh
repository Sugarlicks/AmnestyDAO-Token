#!/bin/bash

# Script to initialize Let's Encrypt certificates
# This should be run once before starting the full stack

set -e

# Configuration
DOMAIN="${DOMAIN:-hrdao.matou.nz}"
EMAIL="${EMAIL:-admin@hrdao.matou.nz}"
STAGING="${STAGING:-0}" # Set to 1 if testing

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Initializing Let's Encrypt certificates for ${DOMAIN}${NC}"

# Create necessary directories
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# Determine if we're using staging or production
if [ "$STAGING" != "0" ]; then
    echo -e "${YELLOW}Using Let's Encrypt staging environment${NC}"
    staging_arg="--staging"
else
    staging_arg=""
fi

# Check if certificates already exist
if [ -d "./certbot/conf/live/${DOMAIN}" ]; then
    echo -e "${GREEN}Certificates already exist for ${DOMAIN}${NC}"
    echo "If you want to renew them, run: docker compose run --rm certbot renew"
    exit 0
fi

# Start nginx with init config (HTTP only, no SSL)
echo -e "${YELLOW}Starting nginx with temporary configuration...${NC}"
# Temporarily use init config
if [ -f "./nginx/nginx.conf" ]; then
    cp ./nginx/nginx.conf ./nginx/nginx.conf.backup 2>/dev/null || true
fi
cp ./nginx/nginx-init.conf ./nginx/nginx.conf

# Start services needed for certificate generation
echo "Starting required services..."
docker compose up -d auth-service postgres

# Wait for auth-service to be ready
echo "Waiting for auth-service to be ready..."
sleep 5

# Start nginx with init config (using production profile)
docker compose --profile production up -d nginx

# Wait for nginx to be ready
echo "Waiting for nginx to be ready..."
sleep 3

# Run certbot to obtain certificates
echo -e "${YELLOW}Obtaining certificates from Let's Encrypt...${NC}"
docker compose --profile production run --rm --entrypoint "certbot" certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    ${staging_arg} \
    -d "${DOMAIN}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Certificates obtained successfully!${NC}"
    
    # Restore full nginx config
    if [ -f "./nginx/nginx.conf.backup" ]; then
        mv ./nginx/nginx.conf.backup ./nginx/nginx.conf
        echo -e "${YELLOW}Restoring full nginx configuration...${NC}"
    else
        echo -e "${YELLOW}Warning: nginx.conf.backup not found. Please ensure nginx.conf has the full SSL configuration.${NC}"
    fi
    
    # Restart nginx with full config
    echo "Restarting nginx with SSL configuration..."
    docker compose --profile production restart nginx
    
    echo -e "${GREEN}Setup complete!${NC}"
    echo "You can now start the full production stack with: docker compose --profile production up -d"
else
    echo -e "${RED}Failed to obtain certificates${NC}"
    echo "Restoring nginx configuration..."
    if [ -f "./nginx/nginx.conf.backup" ]; then
        mv ./nginx/nginx.conf.backup ./nginx/nginx.conf
    fi
    exit 1
fi
