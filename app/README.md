# Amnesty DAO

A decentralized autonomous organization (DAO) platform for human rights activism, built on the Cardano blockchain. This application incentivizes civic engagement through blockchain-based token rewards for activism contributions, campaign donations, and community participation.

## Preview

<img src="./images/splash.png" width="30%" style="margin-right: 10px;"/>   <img src="./images/actions.png" width="30%" style="margin-right: 10px;" />   <img src="./images/transactions.png" width="30%" /> 




## Overview

Amnesty DAO is a full-stack web and mobile application that combines modern web technologies with blockchain to create a token-based incentive system for human rights advocacy. Users earn tokens by completing activism tasks (petitions, sharing content, attending events), which they can then donate to campaigns or use within the DAO ecosystem.

**Product Name**: Human Rights DAO
**Organization**: Amnesty International
**Build Organisation**: Matou

## Technology Stack

### Frontend
- **Framework**: [Quasar](https://quasar.dev/) (Vue 3 + TypeScript)
- **State Management**: Pinia with persisted state
- **GraphQL Client**: Apollo Client with WebSocket subscriptions
- **Internationalization**: Vue I18n
- **Multi-Platform**:
  - Web (Vite)
  - Mobile (Capacitor - iOS & Android)
  - Desktop (Electron)

### Backend
- **Runtime**: Node.js (Express)
- **GraphQL Engine**: Hasura v2.25.1
- **Database**: PostgreSQL 15
- **Authentication**: JWT with Cardano wallet signature (CIP-8)
- **Blockchain**: Cardano (via MeshSDK)
- **Reverse Proxy**: Nginx with Let's Encrypt SSL

### Blockchain Integration
- **Network**: Cardano (Testnet/Mainnet configurable)
- **SDK**: MeshSDK v1.9
- **Wallet**: Non-custodial, BIP39 mnemonic-based
- **Features**:
  - Custom token transactions
  - Treasury management
  - On-chain transaction tracking

### DevOps
- **Containerization**: Docker & Docker Compose
- **Deployment**: DigitalOcean (configurable for any VPS)
- **SSL**: Automated Let's Encrypt certificate management
- **Process Management**: Supervisord

## Key Features

### 1. User Management
- **Registration**: Cardano wallet-based registration with profile creation
- **Authentication**: Signature-based login (CIP-8 standard)
- **User Roles**: Pending, Approved, Admin status system
- **Profiles**: Profile images, affiliations, and personal information

### 2. Contributions System
Users earn tokens by completing various activism tasks:
- **Visit**: View content or external links
- **Share**: Share campaigns and content
- **Scan**: QR code scanning for event check-ins

Each contribution type has configurable token rewards and tracks participant counts.

### 3. Campaigns
- **Campaign Management**: Create and manage fundraising campaigns
- **Categories**: Freedom of Expression, Environmental Rights, Children's Rights, Refugee Rights, Women's Rights, LGBTQ+ Rights, Digital Rights, Economic Justice
- **Token Donations**: Users donate earned tokens to campaigns
- **Progress Tracking**: Real-time tracking of tokens raised vs. goals
- **Campaign Details**: Images, descriptions, deadlines, supporter counts

### 4. Token Economy
- **Token Transactions**: Full transaction history with Cardano blockchain integration
- **Transaction Types**:
  - REWARD: Tokens earned from contributions
  - DONATION: Tokens donated to campaigns
- **On-chain Verification**: All transactions confirmed on Cardano blockchain
- **Wallet Balance**: Real-time balance tracking from blockchain

### 5. Chat System
- **Public Channels**: Community-wide discussion channels
- **Private Chats**: Direct messaging between users
- **Real-time Messaging**: WebSocket-based live updates
- **Read Receipts**: Track message read timestamps
- **Notifications**: Push notifications for new messages
- **Admin Controls**: Admins can create and manage chat channels

### 6. Admin Dashboard
- **User Management**: Approve/reject registrations, manage user roles
- **Contribution Management**: Create and manage activism tasks
- **Campaign Management**: Create and oversee fundraising campaigns
- **Chat Management**: Create public/private chat channels
- **Transaction Monitoring**: View all token transactions and balances

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                           Frontend                                │
│      (Quasar/Vue 3 - Web, iOS, Android, Electron)                 │ 
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌───────┐ │
│  │  Wallet  │  │Contribu- │  │ Campaign │  │   Chat  │  │ Admin │ │
│  │  Pages   │  │  tions   │  │  Pages   │  │  Pages  │  │ Pages │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘  └───────┘ │
│         │              │              │          │         │      │
│         └──────────────┴──────────────┴──────────┴─────────┘      │
│                                │                                  │
│                          Apollo Client                            │
│                      (GraphQL + WebSocket)                        │
└────────────────────────────────┬──────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
┌─────────────────────┐                  ┌──────────────────┐
│   Auth Service      │                  │  Hasura GraphQL  │
│   (Express)         │                  │     Engine       │
│                     │                  │                  │
│ • JWT Auth          │                  │ • Data Queries   │
│ • CIP-8 Sig         │◄─────────────────┤ • Actions        │
│ • Chat APIs         │                  │ • Subscriptions  │
│ • Blockchain Ops    │                  │ • Permissions    │
└──────┬────────────┬─┘                  └────────┬─────────┘
       │            │                             │
       │            │                             │
       │            └──────────────────┐          │
       │                               │          │
       ▼                               ▼          ▼
┌──────────────────┐                  ┌──────────────────────┐
│ Cardano Network  │                  │   PostgreSQL 15      │
│  (via MeshSDK)   │                  │                      │
│                  │                  │ • Users & Profiles   │
│ • Token Txs      │                  │ • Chats & Messages   │
│ • Wallet UTxOs   │                  │ • Campaigns          │
│ • Confirmations  │                  │ • Contributions      │
└──────────────────┘                  │ • Token Transactions │
                                      └──────────────────────┘
```

## Project Structure

```
amnesty-dao/
├── backend/                      # Node.js backend service
│   ├── actions/                  # Hasura action handlers
│   │   ├── admin.js             # Admin blockchain operations
│   │   ├── donate.js            # Campaign donation transactions
│   │   ├── helpers.js           # Blockchain utilities
│   │   ├── rewards.js           # Token reward distribution
│   │   └── token.js             # Token transaction handlers
│   ├── hasura/                   # Hasura GraphQL configuration
│   │   ├── metadata/            # GraphQL schema & permissions
│   │   └── migrations/          # Database migrations
│   ├── nginx/                    # Nginx reverse proxy config
│   ├── scripts/                  # Deployment & utility scripts
│   ├── index.js                 # Main Express server
│   ├── firebase-admin.js        # Push notification setup
│   ├── docker-compose.yaml      # Multi-container orchestration
│   └── dockerfile               # Backend container image
│
└── frontend/                     # Quasar/Vue.js frontend
    ├── src/
    │   ├── assets/              # Fonts, images, logos
    │   ├── boot/                # Quasar boot files (Apollo, i18n)
    │   ├── components/          # Reusable Vue components
    │   │   ├── ChatPanel.vue
    │   │   ├── WalletBalance.vue
    │   │   └── MobileWallet.vue
    │   ├── config/              # App configuration
    │   │   └── contributionTypes.ts
    │   ├── layouts/             # Page layouts
    │   ├── locales/             # i18n translation files
    │   ├── pages/               # Route pages
    │   │   ├── AdminDashboard.vue
    │   │   ├── CampaignsList.vue
    │   │   ├── ChatRoom.vue
    │   │   ├── ContributionsList.vue
    │   │   ├── Login.vue
    │   │   └── Wallet.vue
    │   ├── router/              # Vue Router configuration
    │   ├── stores/              # Pinia state management
    │   │   ├── auth.ts
    │   │   ├── blockchain.ts
    │   │   ├── campaigns.ts
    │   │   ├── chat.ts
    │   │   └── token.ts
    │   └── utils/               # Utility functions
    ├── src-capacitor/           # Mobile (iOS/Android) config
    ├── src-electron/            # Desktop (Electron) config
    └── quasar.config.js         # Quasar framework configuration
```

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm 6.13.4+
- Docker & Docker Compose
- Git

### Local Development

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd amnesty-dao
```

#### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration (see Environment Variables section)

# Start services with Docker Compose
docker compose up -d

# Apply Hasura migrations
cd hasura
hasura migrate apply --database-name default
hasura metadata apply
cd ..
```

#### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
# Create .env file with VITE_* variables (see Environment Variables section)

# Start development server
npm run dev

# Or for mobile development
npm run dev:android
npm run dev:ios

# Or for desktop development
npm run dev:electron
```

### Production Deployment

See `backend/DOCKER_DEPLOYMENT.md` for detailed production deployment instructions including:
- SSL certificate setup with Let's Encrypt
- Nginx configuration
- Environment configuration
- Health checks and monitoring

## Environment Variables

### Backend (.env)
```bash
# Server
NODE_ENV=production
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
POSTGRES_USER=hrdao
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=hrdao_db

# Authentication
JWT_SECRET=<generate-secure-secret>

# Hasura
HASURA_ADMIN_SECRET=<generate-secure-secret>

# Cardano Blockchain
BLOCKFROST_KEY=<your-blockfrost-api-key>
VITE_NETWORK=testnet  # or mainnet
VITE_POLICY_ID=<your-token-policy-id>
VITE_TOKEN_NAME=<your-token-name>
VITE_TREASURY_SCRIPT_ADDRESS=<treasury-address>

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_PRIVATE_KEY=<your-private-key>
FIREBASE_CLIENT_EMAIL=<your-client-email>
```

### Frontend (.env)
```bash
# Build environment
NODE_ENV=development

# Blockchain configuration
VITE_NETWORK=testnet
VITE_POLICY_ID=<your-token-policy-id>
VITE_TOKEN_NAME=<your-token-name>
VITE_TREASURY_SCRIPT_ADDRESS=<treasury-address>
```

## Development

### Database Migrations

Migrations are managed with Hasura CLI:

```bash
cd backend/hasura

# Create a new migration
hasura migrate create "migration_name" --database-name default

# Apply migrations
hasura migrate apply --database-name default

# Check migration status
hasura migrate status --database-name default
```

### Building for Production

#### Frontend
```bash
cd frontend

# Web build
quasar build

# Android build (debug)
npm run build:android:debug

# Android build (release)
npm run build:android:prod

# Electron build
npm run build:electron
```

#### Backend
```bash
cd backend

# Build Docker image
docker build -t amnesty-dao-backend .

# Or use docker-compose
docker compose --profile production up -d
```

## API Endpoints

### Authentication
- `POST /api/register` - Register new user with wallet
- `POST /api/login/options` - Get login challenge
- `POST /api/login/verify` - Verify signature and get JWT

### Chat
- `GET /api/chats` - List user's chats
- `POST /api/chats` - Create new chat (admin only)
- `GET /api/chats/:chatId/messages` - Get chat messages
- `POST /api/chats/:chatId/messages` - Send message
- `PUT /api/chats/:chatId` - Update chat (admin only)
- `POST /api/chats/:chatId/read` - Mark chat as read
- `GET /api/chats/read-timestamps` - Get all read timestamps

### Users
- `GET /api/users` - List approved users
- `GET /api/admin/users` - List all users with balances (admin)
- `PUT /api/users/:userId/status` - Update user status (admin)
- `PUT /api/users/:userId/profile` - Update user profile

### Blockchain
- `POST /api/tx/confirm` - Confirm transaction on-chain
- `GET /api/:walletAddress/balance` - Get wallet balance

### System
- `GET /api/version` - Get version information
- `POST /api/version/update` - Update version info
- `GET /healthz` - Health check endpoint

### Hasura Actions (GraphQL)
- `buildDonationTransaction` - Build unsigned donation transaction
- `donateToCampaign` - Submit signed donation transaction
- `rewardUser` - Reward user with tokens
- `getUserTransactions` - Get user's transaction history

## GraphQL Schema

Access the Hasura console at `http://localhost:8080/console` to explore the full GraphQL schema including:
- Users, Chats, Messages
- Campaigns, Contributions
- Token Transactions
- Real-time subscriptions

## Contributing

1. Follow existing code style and conventions
2. Run linters before committing:
   ```bash
   npm run lint
   npm run format
   ```
3. Test on multiple platforms (web, mobile) when changing UI
4. Update documentation for new features

## Security

- User authentication via cryptographic signatures (CIP-8)
- JWT-based session management
- Hasura row-level permissions
- CORS protection
- Input validation and sanitization
- Secure password storage not required (wallet-based auth)

## License

AGPL-v3

## Support

For issues and questions, please open an issue on the project repository.

---

Built with by Matou Collective for human rights advocacy worldwide.
