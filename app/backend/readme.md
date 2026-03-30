# HRDAO Backend

The backend service for HRDAO MVP, providing authentication, database management, and GraphQL API functionality. The system is built using Node.js, Express, PostgreSQL, and Hasura GraphQL Engine.

## Architecture

The backend consists of three main components:

1. **Auth Service** - Node.js/Express service handling authentication and business logic
2. **PostgreSQL** - Primary database for storing application data
3. **Hasura GraphQL Engine** - Provides GraphQL API and real-time subscriptions

## Prerequisites

- Node.js (v16 or higher)
- Docker and Docker Compose
- PostgreSQL (if running locally without Docker)
- Hasura CLI (optional, for local development)
- Firebase project credentials

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=your_database
DATABASE_URL=postgres://your_user:your_password@postgres:5432/your_database

HASURA_ADMIN_SECRET=your_admin_secret
JWT_SECRET=your_jwt_secret
PORT=4000

FIREBASE_PROJECT_ID=your-firebase-app
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@your-firebase-app.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...........\n-----END PRIVATE KEY-----\n"


```

## Development Setup

### Using Docker (Recommended)

1. Start all services:
```bash
docker-compose up
```

This will start:
- Auth service on port 4000
- PostgreSQL on port 5432
- Hasura GraphQL Engine on port 8080

Note: When making changes to the backend you will need to clear cache before composing up again.
`docker compose build --no-cache``
then 
`docker compose up --force-recreate`

### Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

### Run the migrations

To initialise the database, you will need to run the migrations located at /hasura/migrations.

1. Make sure you have the Hasura CLI installed

2. `cd hasura`

3. Run the migrations

```
hasura migrate apply --all-databases \
--endpoint http://localhost:8080 \
--admin-secret your_admin_secret
```

4. `hasura metadata reload`

## API Endpoints

### Auth Service (Port 4000)

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/verify` - Token verification
- Additional endpoints for specific business logic

### Hasura GraphQL Engine (Port 8080)

- GraphQL endpoint: `http://localhost:8080/v1/graphql`
- Hasura Console: `http://localhost:8080/console`

## Database Management

### Using Hasura Console

1. Access the Hasura Console at `http://localhost:8080/console`
2. Use the admin secret from your environment variables to log in
3. Manage database schema, relationships, and permissions through the console

### Manual Database Management

Connect to PostgreSQL:
```bash
psql -U your_user -d your_database
```

## Development Workflow

1. Make changes to the codebase
2. For database changes:
   - Use Hasura Console for schema changes
   - Or create migration files in the `hasura/migrations` directory
3. Test changes locally
4. Commit and push changes

## Deployment

The backend can be deployed using the provided `deploy.sh` script:

```bash
./deploy.sh
```

This script:
1. Builds the Docker image
2. Pushes it to the registry
3. Deploys the services using Docker Compose

## Project Structure

```
backend/
├── actions/         # Hasura actions
├── hasura/         # Hasura configuration and migrations
├── scripts/        # Utility scripts
├── index.js        # Main application file
├── docker-compose.yaml
└── dockerfile
```

## Dependencies

Key dependencies include:
- Express.js - Web framework
- PostgreSQL - Database
- Hasura - GraphQL engine
- Firebase Admin - Authentication
- JWT - Token management
- Various security and utility libraries

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check PostgreSQL is running
   - Verify environment variables
   - Check network connectivity

2. **Hasura Connection Issues**
   - Verify Hasura can connect to PostgreSQL
   - Check admin secret configuration
   - Ensure JWT secret is properly configured

## License

[Add your license information here]