require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { checkSignature, generateNonce } = require('@meshsdk/core');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const admin = require('./firebase-admin');
const tokenActions = require('./actions/token');
const { rewardReceiverFromTreasury } = require('./actions/rewards');
const donateActions = require('./actions/donate');
const adminActions = require('./actions/admin');
const { waitForTransaction, getBalance } = require('./actions/helpers');

const {
  PORT, DATABASE_URL, JWT_SECRET
} = process.env;

const app = express();

const allowedOrigins = [
  'http://localhost:4000',  // Backend
  'http://localhost:9000',  // Quasar dev server
  'capacitor://localhost',  // Capacitor
  'http://localhost',       // General localhost
  'https://localhost',      // APK localhost
  'http://localhost:8080',  // Alternative dev port
  'http://10.0.2.2:4000',  // Android emulator
  'http://10.0.2.2:9000',  // Android emulator Quasar dev
  'http://10.0.2.2:8080',  // Android emulator alternative port
  'capacitor://10.0.2.2',   // Android emulator Capacitor
  'http://192.168.1.158:9000',  // Local network Capacitor
  'http://192.168.1.164:9501',  // Local network Capacitor (new port)
  'https://134.199.168.68:4000', // DigitalOcean Auth Service
  'https://134.199.168.68:8080', // DigitalOcean Hasura
  'capacitor://134.199.168.68:4000', // DigitalOcean Auth Service Capacitor
  'capacitor://134.199.168.68:8080', // DigitalOcean Hasura Capacitor
  'https://hrdao.matou.nz'
];

// Add CORS debugging middleware
// app.use((req, res, next) => {
//   console.log('Incoming request:', {
//     origin: req.headers.origin,
//     method: req.method,
//     path: req.path,
//     headers: req.headers
//   });
//   next();
// });

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.warn('CORS: Origin not allowed:', origin);
      return callback(new Error('Not allowed by CORS'), false);
    }
    
    // Return the exact origin instead of true to prevent multiple headers
    return callback(null, origin);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Origin', 
    'Accept', 
    'X-Requested-With',
    'X-Platform',
    'X-App-Version',
    'X-Device-Id',
    'User-Agent'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS error: ' + err.message });
  }
  next(err);
});

// Increase JSON body parser limit to handle base64 image data (up to 10MB)
app.use(express.json({ limit: '10mb' }));

// Version endpoint
app.get('/api/version', (req, res) => {
  try {
    const versionInfo = require('./version.json');
    res.json(versionInfo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read version information' });
  }
});

// Version update endpoint
app.post('/api/version/update', (req, res) => {
  try {
    const { version, buildNumber, buildDate } = req.body;
    
    if (!version || !buildNumber) {
      return res.status(400).json({ error: 'Version and buildNumber are required' });
    }

    const versionInfo = {
      version,
      buildNumber: parseInt(buildNumber, 10),
      buildDate: buildDate || new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(__dirname, 'version.json'),
      JSON.stringify(versionInfo, null, 2)
    );

    res.json(versionInfo);
  } catch (error) {
    console.error('Failed to update version:', error);
    res.status(500).json({ error: 'Failed to update version information' });
  }
});

// ============================================================================
// LOGGING ENDPOINT
// ============================================================================
// Receives client-side logs from mobile/web apps
app.post('/api/logs', async (req, res) => {
  try {
    const { level, message, timestamp, context } = req.body;

    // Validate required fields
    if (!level || !message || !timestamp) {
      return res.status(400).json({ 
        error: 'Missing required fields: level, message, and timestamp are required' 
      });
    }

    // Validate log level
    const validLevels = ['log', 'info', 'warn', 'error'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ 
        error: `Invalid log level. Must be one of: ${validLevels.join(', ')}` 
      });
    }

    // Extract user ID from JWT if available (optional)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId || decoded.id || null;
      } catch (error) {
        // Invalid token, but we still accept the log (user might not be logged in)
        console.warn('Invalid JWT in log request:', error.message);
      }
    }

    // Extract device/app info from headers (optional)
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      platform: req.headers['x-platform'] || null,
      appVersion: req.headers['x-app-version'] || null,
      deviceId: req.headers['x-device-id'] || null,
    };

    // Insert log into database
    const result = await db.query(
      `INSERT INTO app_logs (level, message, context, user_id, device_info, app_version, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [
        level,
        message,
        context ? JSON.stringify(context) : null,
        userId,
        JSON.stringify(deviceInfo),
        deviceInfo.appVersion,
        new Date(timestamp)
      ]
    );

    // Also log to server console for immediate visibility
    const consoleMethod = console[level] || console.log;
    const logPrefix = userId ? `[User: ${userId}]` : '[Anonymous]';
    consoleMethod(`${logPrefix} [${level.toUpperCase()}]`, message, context || '');

    res.status(201).json({ 
      success: true, 
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at
    });

  } catch (error) {
    console.error('Failed to store log:', error);
    // Don't fail the request - logging should never break the app
    // Return 200 so client doesn't retry
    res.status(200).json({ 
      success: false, 
      error: 'Log received but not stored',
      message: 'Logging service temporarily unavailable'
    });
  }
});

// Get logs endpoint (for admin/debugging purposes)
app.get('/api/logs', async (req, res) => {
  try {
    // Optional: Add authentication check here for admin access
    const { level, userId, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM app_logs WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (level) {
      paramCount++;
      query += ` AND level = $${paramCount}`;
      params.push(level);
    }

    if (userId) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(userId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);

    res.json({
      logs: result.rows,
      count: result.rows.length,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

  } catch (error) {
    console.error('Failed to retrieve logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // allow up to 10 MB in any single text field:
    fieldSize: 5 * 1024 * 1024,
    // and still cap file uploads if you use any
    fileSize: 5  * 1024 * 1024
  }
}); 

const db = new Pool({ connectionString: DATABASE_URL });

// Nonce stored in DB per user (see users.login_nonce, users.login_nonce_expires_at)


 // 1) Register: store the user's Ed25519 public key
app.post('/api/register', upload.none(), async (req, res) => {
  const { publicKey, firstName, lastName, preferredName, reason, affiliations, profileImage, email, country, language } = req.body;
  if (!publicKey || !firstName || !reason) {
    return res.status(400).json({ error: 'publicKey, firstName, lastName and reason are required' });
  }

  // Validate country if provided
  const validCountries = ['aus', 'nz', 'tw', 'th'];
  if (country && !validCountries.includes(country)) {
    return res.status(400).json({ error: `Invalid country. Must be one of: ${validCountries.join(', ')}` });
  }

  // Validate language if provided
  const validLanguages = ['en', 'zh-TW', 'th'];
  if (language && !validLanguages.includes(language)) {
    return res.status(400).json({ error: `Invalid language. Must be one of: ${validLanguages.join(', ')}` });
  }

  const userId = uuidv4();
  
  // Store base64 image string directly (or null if not provided)
  const imageBase64 = profileImage || null;
  
  const affiliationsArray = (affiliations || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  try {
    const result = await db.query(
      `INSERT INTO users(user_id, public_key, first_name, last_name, preferred_name, reason, affiliations, profile_image, email, country, language) 
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING user_id, status`,
      [userId, publicKey, firstName, lastName, preferredName, reason, affiliationsArray, imageBase64, email, country || null, language || null]
    );

    // reward user with 10 UTIL tokens
    try {
      const txHash = await rewardReceiverFromTreasury(publicKey, '10', userId, null, 'Registration reward');
      return res.json({ userId, status: 'approved', txHash });
    } catch (rewardError) {
      // Log error but don't fail registration if reward fails
      console.error('Reward error (registration still successful):', {
        userId,
        message: rewardError.message
      });
      return res.json({ userId, status: 'pending' });
    }
    

  } catch (err) {
    console.error('Registration error:', {
      message: err.message,
      code: err.code,
      detail: err.detail
    });
    return res.status(500).json({ error: 'DB error: ' + err.message });
  }
});

/**
 * 2) Login options: return a one-time challenge
 */
app.post('/api/login/options', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Check device is approved
  const { rows } = await db.query(
    `SELECT status FROM users WHERE user_id=$1`,
    [ userId ]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'User unknown' });
  }

  if (rows[0].status !== 'approved' && rows[0].status !== 'admin') {
    return res.json({ 
      status: rows[0].status,
      challenge: null
    });
  }

  // Generate a human-readable nonce per MeshJS guide
  const nonce = generateNonce('I agree to the terms and conditions of Amnesty DAO: ');

  await db.query(
    `UPDATE users 
     SET login_nonce = $1, login_nonce_expires_at = NOW() + INTERVAL '10 minutes'
     WHERE user_id = $2`,
    [nonce, userId]
  );

  res.json({ nonce, status: rows[0].status });
});
/**
 * 3) Login verify: check the signature & issue a JWT
 */
app.post('/api/login/verify', async (req, res) => {
  const { userId, signature } = req.body;
  if (!userId || !signature) {
    return res.status(400).json({ error: 'userId and signature are required' });
  }

  // Fetch publicKey and nonce from DB
  const { rows } = await db.query(
    `SELECT public_key, login_nonce, login_nonce_expires_at, profile_image, first_name, last_name, preferred_name, affiliations, status, email, country, language 
     FROM users WHERE user_id=$1`,
    [userId]
  );
  if (!rows.length) {
    return res.status(400).json({ error: 'Unknown user' });
  }

  const record = rows[0];
  if (!record.login_nonce) {
    return res.status(400).json({ error: 'No challenge found for user' });
  }
  if (record.login_nonce_expires_at && new Date(record.login_nonce_expires_at) < new Date()) {
    return res.status(400).json({ error: 'Challenge expired' });
  }

  // In our schema, users.public_key stores the user's Cardano address
  const userAddress = record.public_key;

  // Verify CIP-8 signature using MeshJS helper
  const verified = checkSignature(record.login_nonce, signature, userAddress);

  if (!verified) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Rotate nonce
  await db.query(
    `UPDATE users SET login_nonce = NULL, login_nonce_expires_at = NULL WHERE user_id = $1`,
    [userId]
  );

  // Issue Hasura-compatible JWT
  const token = jwt.sign(
    {
      sub: userId,
      'https://hasura.io/jwt/claims': {
        'x-hasura-default-role': 'user',
        'x-hasura-allowed-roles': ['user'],
        'x-hasura-user-id': userId,
        'x-hasura-user-status': rows[0].status || 'pending'
      }
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ jwt: token, profileImage: rows[0].profile_image, firstName: rows[0].first_name, lastName: rows[0].last_name, preferredName: rows[0].preferred_name, affiliations: rows[0].affiliations, status: rows[0].status, email: rows[0].email, walletAddress: rows[0].public_key, country: rows[0].country, language: rows[0].language });
});

// Chat-related endpoints
app.get('/api/chats', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;

    // Fetch all chats for the user: private ones they participate in, and all public ones
    const { rows: chats } = await db.query(
      `SELECT c.id, c.name, c.is_private, c.image, c.created_at, c.member_count,
              (SELECT content FROM messages 
              WHERE chat_id = c.id 
              ORDER BY sent_at DESC 
              LIMIT 1) as last_message,
              (SELECT sent_at FROM messages 
              WHERE chat_id = c.id 
              ORDER BY sent_at DESC 
              LIMIT 1) as last_message_time
      FROM chats c
      LEFT JOIN chat_participants cp 
        ON c.id = cp.chat_id AND cp.user_id = $1
      WHERE (c.is_private = true AND cp.user_id IS NOT NULL)
          OR (c.is_private = false)
      ORDER BY last_message_time DESC NULLS LAST`,
      [userId]
    );

    // Images are already base64 strings (TEXT type), return as-is
    const processedChats = chats.map(chat => ({
      ...chat,
      image: chat.image || null
    }));

    res.json(processedChats);
  } catch (error) {
    console.error('Error fetching chats:', {
      message: error.message
    });
    res.status(401).json({ error: error.message });
  }
});

app.get('/api/chats/:chatId/messages', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { chatId } = req.params;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;

    // First check if chat exists and is private
    const { rows: [chat] } = await db.query(
      `SELECT is_private FROM chats WHERE id = $1`,
      [chatId]
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Only check for participation if chat is private
    if (chat.is_private) {
      const { rows: participants } = await db.query(
        `SELECT 1 FROM chat_participants 
         WHERE chat_id = $1 AND user_id = $2`,
        [chatId, userId]
      );

      if (participants.length === 0) {
        return res.status(403).json({ error: 'Not a participant in this chat' });
      }
    }

    // Fetch messages for the chat
    const { rows: messages } = await db.query(
      `SELECT m.id, m.content, m.sender_id, m.sent_at,
              u.first_name, u.last_name, u.preferred_name, u.profile_image
       FROM messages m
       JOIN users u ON m.sender_id = u.user_id
       WHERE m.chat_id = $1
       ORDER BY m.sent_at ASC`,
      [chatId]
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', {
      chatId,
      message: error.message
    });
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/api/chats/:chatId/messages', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { chatId } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;

    // First check if chat exists and is private
    const { rows: [chat] } = await db.query(
      `SELECT is_private FROM chats WHERE id = $1`,
      [chatId]
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Only check for participation if chat is private
    if (chat.is_private) {
      const { rows: participants } = await db.query(
        `SELECT 1 FROM chat_participants 
         WHERE chat_id = $1 AND user_id = $2`,
        [chatId, userId]
      );

      if (participants.length === 0) {
        return res.status(403).json({ error: 'Not a participant in this chat' });
      }
    }

    // Insert the new message
    const { rows: [message] } = await db.query(
      `INSERT INTO messages (chat_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, sender_id, sent_at`,
      [chatId, userId, content]
    );

    // Get sender info
    const { rows: [sender] } = await db.query(
      `SELECT first_name, last_name, preferred_name
       FROM users
       WHERE user_id = $1`,
      [userId]
    );

    const response = {
      ...message,
      firstName: sender.first_name,
      lastName: sender.last_name,
      preferredName: sender.preferred_name,
      sent: true
    };

    // Get chat participants based on chat type
    const { rows: participants } = await db.query(
      `SELECT DISTINCT cp.user_id 
       FROM chat_participants cp
       JOIN chats c ON c.id = cp.chat_id
       WHERE cp.chat_id = $1 
       AND cp.user_id != $2
       AND (
         (c.is_private = true AND cp.user_id IS NOT NULL)
         OR c.is_private = false
       )`,
      [chatId, userId]
    );

    // Send notifications to all participants
    for (const participant of participants) {
      await sendNotification(
        participant.user_id,
        chat.name,
        `${sender.first_name}: ${content}`,
        { 
          chatId, 
          messageId: message.id,
          type: 'new_message'
        }
      );
    }

    res.json(response);
  } catch (error) {
    console.error('Error sending message:', {
      chatId,
      message: error.message,
      stack: error.stack
    });
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Add new endpoint for creating chats
app.post('/api/chats', upload.none(), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { name, isPrivate, image } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Chat name is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;
    
    // Check if user is admin
    const { rows: userRows } = await db.query(
      `SELECT status FROM users WHERE user_id = $1`,
      [userId]
    );
    
    if (!userRows.length || userRows[0].status !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create chat channels' });
    }

    // Store base64 image string directly (or null if not provided)
    const imageBase64 = image || null;

    const isPrivateBool = isPrivate === true || isPrivate === 'true';

    const { rows: [chat] } = await db.query(
      `INSERT INTO chats (name, is_private, image, created_at, member_count)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 1)
       RETURNING id, name, is_private, image, created_at, member_count`,
      [name, isPrivateBool, imageBase64]
    );

    // Add creator as participant
    if (isPrivateBool) {
      await db.query(
        `INSERT INTO chat_participants (chat_id, user_id)
       VALUES ($1, $2)`,
        [chat.id, userId]
      );
    }

    // Image is already base64 string, return as-is
    const responseChat = {
      ...chat,
      image: chat.image || null
    };

    res.json(responseChat);
  } catch (error) {
    console.error('Error creating chat:', {
      name,
      message: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

// Add new endpoint for fetching all users
app.get('/api/users', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {

    // Fetch all users
    const { rows: users } = await db.query(
      `SELECT user_id as id, first_name as "firstName", last_name as "lastName", 
              preferred_name as "preferredName", profile_image as "profileImage", 
              affiliations, status
       FROM users
       WHERE status = 'approved' OR status = 'admin'`
    );

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', {
      message: error.message
    });
    res.status(401).json({ error: error.message });
  }
});

// Add new endpoint for fetching all users with statuses and token balances
app.get('/api/admin/users', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {

    // Fetch all users with their statuses and token balances
    // Calculate balances from token_transactions (balances are tracked on-chain, this is for display)
    const { rows: users } = await db.query(
      `SELECT u.user_id as id, u.first_name as "firstName", u.last_name as "lastName", 
              u.preferred_name as "preferredName", u.profile_image as "profileImage", 
              u.affiliations, u.status, u.created_at as "createdAt",
              COALESCE(
                (SELECT COALESCE(SUM(COALESCE(tt_in.token_amount, tt_in.amount, 0)), 0)
                 FROM token_transactions tt_in
                 WHERE tt_in.to_user_id = u.user_id
                   AND (tt_in.transaction_status IS NULL OR tt_in.transaction_status = 'confirmed')
                ) - 
                (SELECT COALESCE(SUM(COALESCE(tt_out.token_amount, tt_out.amount, 0)), 0)
                 FROM token_transactions tt_out
                 WHERE tt_out.from_user_id = u.user_id
                   AND (tt_out.transaction_status IS NULL OR tt_out.transaction_status = 'confirmed')
                ),
                0
              ) as "tokenBalance"
       FROM users u`
    );

    // Profile images are already base64 strings (TEXT type), return as-is
    const processedUsers = users.map(user => ({
      ...user,
      profileImage: user.profileImage || null
    }));

    res.json(processedUsers);
  } catch (error) {
    console.error('Error fetching all users:', {
      message: error.message
    });
    res.status(401).json({ error: error.message });
  }
});

// Add health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Add endpoint for updating chat read timestamp
app.post('/api/chats/:chatId/read', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { chatId } = req.params;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;

    // Upsert the read timestamp
    const { rows: [timestamp] } = await db.query(
      `INSERT INTO chat_read_timestamps (user_id, chat_id, last_read_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, chat_id) 
       DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
       RETURNING last_read_at`,
      [userId, chatId]
    );

    res.json({ lastReadAt: timestamp.last_read_at });
  } catch (error) {
    console.error('Error updating read timestamp:', {
      chatId,
      message: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint for fetching chat read timestamps
app.get('/api/chats/read-timestamps', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;

    // Fetch all read timestamps for the user
    const { rows: timestamps } = await db.query(
      `SELECT crt.chat_id, crt.last_read_at, c.name as chat_name
       FROM chat_read_timestamps crt
       JOIN chats c ON c.id = crt.chat_id
       WHERE crt.user_id = $1`,
      [userId]
    );

    // Convert to a map of chat_id -> timestamp
    const timestampMap = timestamps.reduce((acc, { chat_id, last_read_at }) => {
      acc[chat_id] = last_read_at;
      return acc;
    }, {});

    res.json(timestampMap);
  } catch (error) {
    console.error('Error fetching read timestamps:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message });
  }
});

// Add this endpoint to register FCM tokens
app.post('/api/notifications/register', async (req, res) => {
  const { token, platform } = req.body;
  const userId = req.user.id; // Assuming you have user info from auth middleware

  try {
    // Store the token in your database
    await db.query(
      'INSERT INTO user_notification_tokens (user_id, token, platform) VALUES ($1, $2, $3) ON CONFLICT (user_id, platform) DO UPDATE SET token = $2',
      [userId, token, platform]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error registering notification token:', error);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// Add this function to send notifications
async function sendNotification(userId, title, body, data = {}) {
  try {
    // Get user's FCM token from your database
    const { rows } = await db.query(
      'SELECT token FROM user_notification_tokens WHERE user_id = $1',
      [userId]
    );

    if (rows.length === 0) {
      console.log(`No FCM token found for user ${userId}`);
      return;
    }

    // Send notification to all user's devices
    const message = {
      notification: {
        title,
        body
      },
      data,
      tokens: rows.map(row => row.token)
    };

    const response = await admin.messaging().sendMulticast(message);
    
    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(rows[idx].token);
        }
      });
      
      // Remove failed tokens from database
      if (failedTokens.length > 0) {
        await db.query(
          'DELETE FROM user_notification_tokens WHERE token = ANY($1)',
          [failedTokens]
        );
      }
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// Add new endpoint for updating user status
app.put('/api/users/:userId/status', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'approved', 'rejected', 'admin'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Update user status
    const { rows } = await db.query(
      `UPDATE users 
       SET status = $1 
       WHERE user_id = $2 
       RETURNING user_id, status`,
      [status, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating user status:', {
      message: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

// Add new endpoint for updating user profile
app.put('/api/users/:userId/profile', upload.none(), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { userId } = req.params;
  const { firstName, lastName, preferredName, email, affiliations, profileImage, country, language } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const requestingUserId = decoded.sub;
    
    // Users can only update their own profile
    if (requestingUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
    }

    // Validate country if provided
    if (country !== undefined) {
      const validCountries = ['aus', 'nz', 'tw', 'th'];
      if (country !== null && !validCountries.includes(country)) {
        return res.status(400).json({ error: `Invalid country. Must be one of: ${validCountries.join(', ')}` });
      }
    }

    // Validate language if provided
    if (language !== undefined) {
      const validLanguages = ['en', 'zh-TW', 'th'];
      if (language !== null && !validLanguages.includes(language)) {
        return res.status(400).json({ error: `Invalid language. Must be one of: ${validLanguages.join(', ')}` });
      }
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(lastName);
    }
    if (preferredName !== undefined) {
      updates.push(`preferred_name = $${paramIndex++}`);
      values.push(preferredName || null);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (affiliations !== undefined) {
      const affiliationsArray = (affiliations || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      updates.push(`affiliations = $${paramIndex++}`);
      values.push(affiliationsArray);
    }
    if (profileImage !== undefined) {
      // Store base64 image string directly (or null if not provided)
      const imageBase64 = profileImage || null;
      updates.push(`profile_image = $${paramIndex++}`);
      values.push(imageBase64);
    }
    if (country !== undefined) {
      updates.push(`country = $${paramIndex++}`);
      values.push(country || null);
    }
    if (language !== undefined) {
      updates.push(`language = $${paramIndex++}`);
      values.push(language || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING user_id as id, first_name as "firstName", last_name as "lastName", 
                preferred_name as "preferredName", email, affiliations, status, profile_image as "profileImage", country, language
    `;

    const { rows } = await db.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating user profile:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message });
  }
});

// Add new endpoint for updating chats
app.put('/api/chats/:chatId', upload.none(), async (req, res) => {
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Error: Unauthorized - No valid auth header');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { chatId } = req.params;
  const { name, isPrivate, image } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Chat name is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;

    // Store base64 image string directly (or null if not provided)
    const imageBase64 = image || null;

    const { rows: [chat] } = await db.query(
      `UPDATE chats 
       SET name = $1, is_private = $2, image = $3
       WHERE id = $4
       RETURNING id, name, is_private, image, created_at, member_count`,
      [name, isPrivate === true || isPrivate === 'true', imageBase64, chatId]
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Image is already base64 string, return as-is
    const responseChat = {
      ...chat,
      image: chat.image || null
    };

    res.json(responseChat);
  } catch (error) {
    console.error('Error updating chat:', {
      chatId,
      message: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

// Add new endpoint to confirm a transaction (waits for confirmation and updates DB)
app.post('/api/tx/confirm', async (req, res) => {
  const { txHash, type } = req.body;
  
  if (!txHash || !type) {
    return res.status(400).json({ 
      success: false, 
      error: 'txHash and type are required' 
    });
  }
  
  if (type !== 'DONATION' && type !== 'REWARD') {
    return res.status(400).json({ 
      success: false, 
      error: 'type must be either "DONATION" or "REWARD"' 
    });
  }
  
  try {
    // Wait for transaction confirmation (5 minute timeout)
    await waitForTransaction(txHash);
    
    // Transaction confirmed - update DB
    const result = await db.query(
      `UPDATE token_transactions 
       SET transaction_status = 'CONFIRMED', confirmed_at = NOW()
       WHERE cardano_tx_hash = $1
       RETURNING id`,
      [txHash]
    );
    
    if (result.rowCount === 0) {
      console.warn(`Transaction ${txHash} confirmed on chain but not found in database`);
    }
    
    return res.json({ 
      success: true, 
      status: 'CONFIRMED' 
    });
  } catch (error) {
    console.error('Transaction confirmation failed:', {
      txHash,
      type,
      message: error.message,
      stack: error.stack
    });
    
    // Update DB with failed status
    try {
      await db.query(
        `UPDATE token_transactions 
         SET transaction_status = 'FAILED', error_message = $1
         WHERE cardano_tx_hash = $2`,
        [error.message || 'Transaction confirmation timeout', txHash]
      );
    } catch (dbError) {
      console.error('Failed to update transaction status in DB:', dbError);
    }
    
    return res.status(504).json({ 
      success: false, 
      status: 'FAILED',
      errorMessage: error.message || 'Transaction confirmation timeout'
    });
  }
});

// Add new endpoint to get the wallet balance for the given wallet address
app.get('/api/:walletAddress/balance', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    const balance = await getBalance(walletAddress);
    return res.json({ balance: balance });
  } catch (error) {
    console.error('Get balance failed:', {
      message: error.message
    });
    return res.status(500).json({ error: error.message });
  }
});

// Start HTTP server
// Note: SSL termination is handled by nginx reverse proxy
app.listen(PORT, () => {
  console.log(`HTTP Server now listening on port ${PORT}`);
});

// Token action handlers
app.post('/actions/buildDonationTransaction', donateActions.buildDonationTransaction);
app.post('/actions/donateToCampaign', donateActions.donateToCampaign);
app.post('/actions/rewardUser', tokenActions.rewardUser);

// Admin action handlers (blockchain-based)
app.post('/actions/getUserTransactions', adminActions.getUserTransactions);
