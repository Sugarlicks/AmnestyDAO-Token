# Docker Deployment Guide with Nginx

This guide explains how to deploy the backend using Docker with nginx as a reverse proxy for SSL termination.

## Architecture

- **Nginx**: Handles SSL termination, reverse proxy, and rate limiting
- **Auth Service**: Node.js backend API (runs on port 4000 internally)
- **Hasura**: GraphQL engine (runs on port 8080 internally)
- **PostgreSQL**: Database
- **Certbot**: Automated SSL certificate management

## Prerequisites

1. Docker and Docker Compose installed
2. Domain name pointing to your server IP
3. Ports 80 and 443 open in firewall
4. `.env` file configured with all required environment variables

## Initial Setup

### 1. Configure Environment Variables

Ensure your `.env` file contains:

```bash
# Database
POSTGRES_USER=hrdao
POSTGRES_PASSWORD=your_password
POSTGRES_DB=hrdao_db
DATABASE_URL=postgres://hrdao:your_password@postgres:5432/hrdao_db

# JWT
JWT_SECRET=your_jwt_secret

# Hasura
HASURA_ADMIN_SECRET=your_hasura_admin_secret

# Node Environment
NODE_ENV=production

# Domain (for SSL)
DOMAIN=hrdao.matou.nz
EMAIL=info@matou.nz
```

### 2. Initialize SSL Certificates

Run the initialization script to obtain Let's Encrypt certificates:

```bash
cd backend
./scripts/init-letsencrypt.sh
```

Or with custom domain/email:

```bash
DOMAIN=yourdomain.com EMAIL=your@email.com ./scripts/init-letsencrypt.sh
```

**Note**: For testing, you can use Let's Encrypt staging:

```bash
STAGING=1 ./scripts/init-letsencrypt.sh
```

This script will:
1. Start the backend services
2. Start nginx with a temporary HTTP-only configuration
3. Obtain SSL certificates using certbot
4. Switch nginx to the full SSL configuration

### 3. Build and Start All Services

Once certificates are obtained, build and start the full production stack (including nginx):

```bash
# Build containers (required if package.json or code changed)
docker compose --profile production build

# Start all containers
docker compose --profile production up -d
```

**Note**: For development, just run `docker compose up` (without the profile flag) to start only postgres, auth-service, and graphql-engine.

**Important**: If you see errors rebuild the containers with `docker compose --profile production build --no-cache` to ensure the latest code base.

## Deployment Workflow

### Standard Deployment

For production deployment:

```bash
# Pull latest images
docker compose pull

# Build containers
docker compose build

# Stop existing containers
docker compose down

# Start all containers (including nginx)
docker compose --profile production up -d

# Check logs
docker compose logs -f
```

For development:

```bash
# Start only dev services
docker compose up

# Or build and start
docker compose build
docker compose up -d
```

### Using the Deploy Script

The existing `deploy.sh` script works with the Docker setup:

```bash
./deploy.sh
```

## SSL Certificate Renewal

Certificates are automatically renewed by the certbot container, which runs every 12 hours. Nginx automatically reloads every 6 hours to pick up renewed certificates.

To manually renew certificates:

```bash
docker compose run --rm certbot renew
docker compose restart nginx
```

## Service Access

After deployment:

- **Backend API**: `https://hrdao.matou.nz/api/*`
- **Health Check**: `https://hrdao.matou.nz/healthz`
- **Hasura GraphQL**: `https://hrdao.matou.nz/v1/graphql`
- **Hasura Console**: `https://hrdao.matou.nz/console/` (if enabled)

## Troubleshooting

### Check Service Status

```bash
docker compose ps
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f nginx
docker compose logs -f auth-service
docker compose logs -f certbot
```

### Test Nginx Configuration

```bash
docker compose exec nginx nginx -t
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart nginx
```

### Check SSL Certificates

```bash
# List certificates
docker compose run --rm certbot certificates

# Check certificate expiry
docker compose exec nginx openssl x509 -in /etc/letsencrypt/live/hrdao.matou.nz/cert.pem -noout -dates
```

### Common Issues

1. **Nginx fails to start**: Check if certificates exist in `./certbot/conf/live/`
2. **502 Bad Gateway**: Ensure backend services are running (`docker compose ps`)
3. **SSL errors**: Verify certificates are valid and not expired
4. **Port conflicts**: Ensure ports 80 and 443 are not used by other services

## Development Mode

For local development, only the core services run (no nginx/certbot):

```bash
# Start dev services (postgres, auth-service, graphql-engine)
docker compose up

# Or in detached mode
docker compose up -d
```

This will start:
- **postgres** on port 5432
- **auth-service** on port 4000 (direct access)
- **graphql-engine** on port 8080 (direct access)

Nginx and certbot are excluded by default (they use the `production` profile).

To start all services including nginx for production:

```bash
docker compose --profile production up -d
```

## Production Checklist

- [ ] Domain DNS points to server IP
- [ ] Firewall allows ports 80 and 443
- [ ] SSL certificates obtained and valid
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Hasura metadata applied
- [ ] Health checks passing
- [ ] Logs monitored for errors

## File Structure

```
backend/
├── docker-compose.yaml      # Main Docker Compose configuration
├── dockerfile               # Backend service Dockerfile
├── nginx/
│   ├── Dockerfile           # Nginx Dockerfile
│   ├── nginx.conf           # Production nginx config (with SSL)
│   └── nginx-init.conf      # Initial nginx config (HTTP only)
├── scripts/
│   └── init-letsencrypt.sh  # SSL certificate initialization
└── certbot/
    ├── conf/                # SSL certificates (gitignored)
    └── www/                 # ACME challenge files
```

## Security Notes

- SSL certificates are stored in `./certbot/conf/` - ensure this directory is backed up
- Never commit `.env` file or certificate files to git
- Rate limiting is configured in nginx for API protection
- Security headers are set in nginx configuration
- Backend services are not exposed directly to the internet (only through nginx)

