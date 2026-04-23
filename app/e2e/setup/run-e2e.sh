#!/bin/bash
#
# E2E Test Runner
# Checks prerequisites, starts services if needed, and runs Playwright tests.
#
# Usage:
#   ./e2e/setup/run-e2e.sh              # headless
#   ./e2e/setup/run-e2e.sh --headed     # watch in browser
#   ./e2e/setup/run-e2e.sh --debug      # step-through debugger
#

set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
E2E_DIR="$ROOT_DIR/e2e"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[E2E]${NC} $1"; }
warn()  { echo -e "${YELLOW}[E2E]${NC} $1"; }
error() { echo -e "${RED}[E2E]${NC} $1"; }

# ─── Check backend/.env ───
if [ ! -f "$BACKEND_DIR/.env" ]; then
  error "backend/.env not found."
  echo ""
  echo "  Create it from the example:"
  echo "    cp backend/.env.example backend/.env"
  echo ""
  echo "  Then edit the values (at minimum DATABASE_URL, JWT_SECRET, HASURA_ADMIN_SECRET)."
  exit 1
fi
info "backend/.env found"

# ─── Check Docker ───
if ! docker info > /dev/null 2>&1; then
  error "Docker is not running. Please start Docker Desktop first."
  exit 1
fi
info "Docker is running"

# ─── Check/start backend services ───
BACKEND_RUNNING=true
curl -sf http://localhost:4000/healthz > /dev/null 2>&1 || BACKEND_RUNNING=false

if [ "$BACKEND_RUNNING" = false ]; then
  warn "Backend services not running. Starting docker compose..."
  cd "$BACKEND_DIR"
  docker compose up -d

  info "Waiting for PostgreSQL to be healthy..."
  for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U hrdao > /dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  info "Waiting for auth service..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:4000/healthz > /dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  if ! curl -sf http://localhost:4000/healthz > /dev/null 2>&1; then
    error "Auth service failed to start. Check: docker compose logs auth-service"
    exit 1
  fi

  info "Waiting for Hasura..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:8080/healthz > /dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  if ! curl -sf http://localhost:8080/healthz > /dev/null 2>&1; then
    error "Hasura failed to start. Check: docker compose logs graphql-engine"
    exit 1
  fi

  # Apply migrations
  if command -v hasura > /dev/null 2>&1; then
    info "Applying Hasura migrations..."
    cd "$BACKEND_DIR/hasura"
    hasura migrate apply --database-name default 2>&1 || warn "Migrations may already be applied"
    hasura metadata apply 2>&1 || warn "Metadata may already be applied"
  else
    warn "Hasura CLI not found — skipping migrations. Install with: npm install -g hasura-cli"
  fi

  cd "$ROOT_DIR"
else
  info "Backend services already running"
fi

# ─── Check/start frontend ───
FRONTEND_RUNNING=true
curl -sf http://localhost:9000 > /dev/null 2>&1 || FRONTEND_RUNNING=false

if [ "$FRONTEND_RUNNING" = false ]; then
  # Also check default Quasar dev port 9000 and Vite port 5173
  curl -sf http://localhost:5173 > /dev/null 2>&1 && FRONTEND_RUNNING=true
fi

if [ "$FRONTEND_RUNNING" = false ]; then
  warn "Frontend not running."
  echo ""
  echo "  Start the frontend in another terminal:"
  echo "    cd frontend && npm run dev"
  echo ""
  echo "  Or build and serve:"
  echo "    cd frontend && npm run build:prod && npx serve dist/spa -l 9000"
  echo ""
  exit 1
fi
info "Frontend is accessible"

# ─── Install e2e deps if needed ───
if [ ! -d "$E2E_DIR/node_modules" ]; then
  info "Installing E2E dependencies..."
  cd "$E2E_DIR"
  npm install
  npx playwright install chromium
  cd "$ROOT_DIR"
fi

# ─── Run tests ───
info "Running Playwright tests ${1:+with $1}..."
cd "$E2E_DIR"
npx playwright test $@
