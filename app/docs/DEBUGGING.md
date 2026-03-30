# Debugging and Logging Guide

A comprehensive guide for debugging Android apps and using remote logging.

## Quick Start: Viewing Logs

### Method 1: Chrome DevTools (Recommended for Console Logs)

**Best for:** JavaScript console logs in production

1. **Enable web debugging:**
   ```bash
   ENABLE_WEB_DEBUG=true npm run build:android:prod
   ```
   Or edit `frontend/src-capacitor/capacitor.config.js`:
   ```javascript
   android: {
     webContentsDebuggingEnabled: true
   }
   ```

2. **Use Chrome DevTools:**
   - Build and install app on device/emulator
   - Open Chrome → `chrome://inspect`
   - Find your app under "Remote Target" → Click "inspect"
   - View console logs, network requests, etc.

### Method 2: ADB Logcat (Recommended for Native Logs)

**Best for:** Production debugging, native Android logs

```bash
# View all logs in real-time
adb logcat

# Filter for console logs
adb logcat -s R5CWB0TC3CE chromium:I *:S

# Filter by app package
adb -s R5CWB0TC3CE logcat | grep "hrdao.capacitor.app"

# Errors only
adb logcat *:E

# Save to file
adb logcat > app-logs.txt
```

**Setup:** Enable USB Debugging on device (Settings → Developer Options)

### Method 3: Logger Utility (Recommended for Production)

**Best for:** Custom logging with remote backend support

```typescript
import { logger } from '@/utils/logger';

// Use instead of console.log
logger.log('User logged in', { userId: '123' });
logger.info('App started');
logger.warn('Slow network detected');
logger.error('Login failed', error);

// Get all logs
const logs = logger.getLogs();
```

The logger automatically:
- Outputs to console (visible in ADB logcat)
- Stores logs in memory (last 1000 entries)
- Sends logs to remote server if enabled

## Remote Logging Setup

### Enable Remote Logging

Add to `.env`:
```
VITE_REMOTE_LOGGING_URL=https://your-backend.com/api/logs
```

Or the logger will use `${config.authUrl}/api/logs` by default.

### API Endpoints

**POST /api/logs** - Send logs from client
```json
{
  "level": "error",
  "message": "Login failed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "context": { "error": "Invalid credentials" }
}
```

**Headers (optional):**
- `Authorization: Bearer <jwt_token>` - Extracts user_id
- `X-App-Version: 1.0.0` - App version
- `X-Platform: android` - Platform (android/ios/web)
- `X-Device-Id: device_123` - Device identifier

**GET /api/logs** - Retrieve stored logs
```
GET /api/logs?level=error&limit=50&userId=user-uuid
```

### Database Schema

Logs are stored in `app_logs` table:
- `id` (uuid) - Primary key
- `level` (text) - 'log', 'info', 'warn', 'error'
- `message` (text) - Log message
- `context` (jsonb) - Additional context data
- `user_id` (uuid) - Optional user ID
- `device_info` (jsonb) - Device/platform info
- `app_version` (text) - App version
- `timestamp` (timestamp) - When log was created (from client)
- `created_at` (timestamp) - When stored in database

**Migration:** `backend/hasura/migrations/default/1759000000000_create_app_logs/up.sql`

### Querying Logs

```sql
-- Recent errors
SELECT * FROM app_logs 
WHERE level = 'error' 
ORDER BY created_at DESC 
LIMIT 100;

-- User-specific logs
SELECT * FROM app_logs 
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC;

-- Errors in last hour
SELECT COUNT(*) FROM app_logs 
WHERE level = 'error' 
AND created_at >= NOW() - INTERVAL '1 hour';
```

## Additional Methods

### Android Studio Logcat
1. Open Android Studio
2. Connect device
3. View → Tool Windows → Logcat
4. Filter by package: `hrdao.capacitor.app`

### Wireless ADB (No USB)
```bash
# First time (requires USB)
adb tcpip 5555
adb connect <DEVICE_IP>:5555

# Then use wirelessly
adb logcat
```

Find device IP: Settings → About Phone → Status → IP Address

## Quick Reference

| Method | Best For | Requirements |
|--------|----------|-------------|
| Chrome DevTools | JavaScript console logs | `webContentsDebuggingEnabled: true` |
| ADB Logcat | Production debugging, native logs | USB cable, ADB installed |
| Logger Utility | Custom logging, remote logs | Code changes |
| Android Studio | Visual log viewer | Android Studio installed |
| Remote Logging | Centralized log storage | Backend API configured |

## Troubleshooting

**"device unauthorized" error:**
- Check "Always allow from this computer" when prompted
- Revoke USB debugging authorizations and reconnect

**No logs appearing:**
- Ensure USB debugging is enabled
- Try `adb kill-server && adb start-server`
- Check connection: `adb devices`

**Can't see console.log output:**
- Use `logger.log()` instead of `console.log()`
- Use Chrome DevTools with web debugging enabled
- Check ADB logcat: `adb logcat chromium:I *:S`

## Security Notes

⚠️ **Important:**
- Only enable `webContentsDebuggingEnabled` in production if necessary
- Consider using it only for internal testing builds
- Use ADB logcat for production debugging when possible
- Add rate limiting to `/api/logs` endpoint
- Secure GET endpoint with admin authentication
- Consider data retention policies for old logs

## Cleanup

To prevent database growth:
```sql
-- Delete logs older than 30 days
DELETE FROM app_logs 
WHERE created_at < NOW() - INTERVAL '30 days';
```

Set up a cron job to run this periodically.

