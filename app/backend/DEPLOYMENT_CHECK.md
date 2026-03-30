# Backend Deployment Verification Guide

This guide helps you verify that your backend is correctly deployed on your DigitalOcean droplet.

## Quick Verification

### Option 1: Automated Script (Recommended)

Run the verification script:

```bash
cd backend
./verify-deployment.sh
```

Or specify a custom URL:

```bash
BACKEND_URL=https://hrdao.matou.nz:4000 ./verify-deployment.sh
```

### Option 2: Manual Testing

Test these endpoints manually:

#### 1. Health Check
```bash
curl https://hrdao.matou.nz:4000/healthz
# Expected: {"status":"ok"}
```

#### 2. Version Endpoint
```bash
curl https://hrdao.matou.nz:4000/api/version
# Expected: JSON with version information
```

#### 3. CORS Configuration
```bash
curl -X OPTIONS \
  -H "Origin: https://hrdao.matou.nz" \
  -H "Access-Control-Request-Method: POST" \
  https://hrdao.matou.nz:4000/api/register
# Expected: HTTP 204 or 200
```

#### 4. Database Connectivity (indirect test)
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  https://hrdao.matou.nz:4000/api/register \
  -d '{}'
# Expected: HTTP 400 (bad request - means endpoint is working and validating)
```

## What to Check on the Server

SSH into your droplet and verify:

### 1. Check if the service is running

```bash
# If using Docker Compose
docker compose ps

# If using PM2
pm2 list

# If using systemd
sudo systemctl status your-service-name
```

### 2. Check logs

```bash
# Docker Compose logs
docker compose logs -f auth-service

# PM2 logs
pm2 logs

# Systemd logs
sudo journalctl -u your-service-name -f
```

### 3. Check environment variables

```bash
# If using Docker Compose
docker compose exec auth-service env | grep -E 'DATABASE_URL|JWT_SECRET|PORT'

# If using PM2
pm2 env <process-id>
```

### 4. Check port binding

```bash
# Check if port 4000 is listening
sudo netstat -tlnp | grep 4000
# or
sudo ss -tlnp | grep 4000
```

### 5. Check firewall

```bash
# Check UFW status
sudo ufw status

# Check if port 4000 is open
sudo ufw status | grep 4000
```

### 6. Check SSL certificates (if using HTTPS)

```bash
# Check certificate files exist
ls -la /etc/letsencrypt/live/hrdao.matou.nz/

# Test certificate
openssl s_client -connect hrdao.matou.nz:4000 -servername hrdao.matou.nz
```

## Common Issues and Solutions

### Issue: Connection refused
- **Check**: Is the service running?
- **Solution**: Start the service and check logs for errors

### Issue: SSL certificate errors
- **Check**: Are certificates installed and valid?
- **Solution**: Ensure Let's Encrypt certificates are properly configured

### Issue: Database connection errors
- **Check**: Is PostgreSQL running? Is DATABASE_URL correct?
- **Solution**: Verify database is accessible and connection string is correct

### Issue: CORS errors
- **Check**: Is the frontend domain in the allowedOrigins list?
- **Solution**: Update CORS configuration in `index.js`

### Issue: Port not accessible
- **Check**: Is the firewall configured? Is the port bound correctly?
- **Solution**: Open port in firewall: `sudo ufw allow 4000/tcp`

## Expected Results

When everything is working correctly:

✅ Health check returns `{"status":"ok"}`  
✅ Version endpoint returns version JSON  
✅ CORS preflight requests succeed  
✅ Database endpoints respond (even with validation errors)  
✅ SSL certificate is valid (if using HTTPS)  
✅ Port is accessible from outside  
✅ No environment variable errors in logs  

## Next Steps After Verification

Once verification passes:

1. ✅ Update frontend configuration to point to the backend URL
2. ✅ Test user registration flow
3. ✅ Test user login flow
4. ✅ Verify Hasura GraphQL endpoint is accessible
5. ✅ Test all API endpoints from the frontend

## Server Information

- **Domain**: hrdao.matou.nz
- **IP Address**: 128.199.220.197
- **Backend Port**: 4000 (or as configured in PORT env var)
- **Hasura Port**: 8080 (if deployed)

