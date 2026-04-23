# Access Validation Test Report

**Date:** 2026-04-22
**Scope:** Role-based permission enforcement across UI and backend layers
**Objective:** Validate that restricted actions cannot be performed by unauthorized roles (Task 5.2)

---

## 1. Roles and Access Model

The platform defines two effective roles:

| Role | How assigned | Where checked |
|---|---|---|
| **user** | All authenticated users via JWT (`x-hasura-default-role: 'user'`) | Hasura permissions, Express middleware |
| **admin** | Database field `users.status = 'admin'` | Express endpoint checks (inconsistent), Hasura row-level WHERE clauses |

There is **no separate Hasura admin role**. All users receive the `user` role in their JWT. Admin privileges are checked by querying the database `users.status` field, either in Express middleware or in Hasura WHERE clause filters using `_exists` subqueries.

### JWT Structure (backend/index.js:436-448)

```javascript
jwt.sign({
  sub: userId,
  'https://hasura.io/jwt/claims': {
    'x-hasura-default-role': 'user',        // always 'user', never 'admin'
    'x-hasura-allowed-roles': ['user'],
    'x-hasura-user-id': userId,
    'x-hasura-user-status': rows[0].status  // informational only
  }
}, JWT_SECRET, { expiresIn: '12h' });
```

The `x-hasura-user-status` claim is included but not used by Hasura for role selection — it's purely informational.

---

## 2. Hasura Permission Validation

### Properly secured tables

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|
| `contributions` | Active only (admins see all) | Owner check | Owner check | Owner check | Correct row-level security |
| `campaign_donations` | Own only (admins see all) | Owner check | None | None | Correct — donations are immutable |
| `token_transactions` | Own only (admins see all) | None | None | None | Correct — transactions are immutable |
| `user_contributions` | Own only | Owner check | None | None | Correct |
| `chat_read_timestamps` | Own only | Owner check | Owner check | Owner check | Correct |

### Insufficiently secured tables

| Table | Issue | Severity | Details |
|---|---|---|---|
| **campaigns** | UPDATE/DELETE have no row-level filter | **HIGH** | Any authenticated user can update or delete any campaign, not just their own. `backend/hasura/metadata/databases/default/tables/public_campaigns.yaml` lines 64-82 |
| **messages** | SELECT/UPDATE/DELETE have empty filter `{}` | **HIGH** | Any authenticated user can read, modify, or delete any message in any chat. `public_messages.yaml` lines 30, 40, 45 |
| **users** | SELECT has empty filter `{}` | **MEDIUM** | Any authenticated user can read all user records. `public_users.yaml` line 76. Acceptable if user directory is intended, but exposes all columns. |
| **chats** | SELECT has empty filter `{}` | **LOW** | Any authenticated user can see all chat channels. May be intentional for public channels. |

---

## 3. Express Backend Authorization Validation

### Admin-protected endpoints (correctly secured)

| Endpoint | Auth check | Admin check | Location |
|---|---|---|---|
| `POST /api/chats` (create channel) | JWT verified | DB status check | index.js:679-686 |
| `PUT /api/users/:userId/profile` | JWT verified | Ownership check (own profile only) | index.js:990-996 |
| `POST /api/chats/:chatId/messages` | JWT verified | Chat membership check | index.js:585-595 |

### Endpoints missing admin authorization

| Endpoint | Auth check | Admin check | Severity | Impact |
|---|---|---|---|---|
| **`PUT /api/users/:userId/status`** | Bearer token exists (not verified) | **NONE** | **CRITICAL** | Any request with any Bearer token can set any user to `admin` status. Privilege escalation. (index.js:942-976) |
| **`GET /api/admin/users`** | JWT verified | **NONE** | **HIGH** | Any authenticated user can list all users with token balances. (index.js:753-796) |
| **`GET /api/logs`** | **Optional** (commented TODO) | **NONE** | **MEDIUM** | Application logs accessible without authentication. (index.js:223-260) |

### Hasura Action handlers — JWT not verified

| Handler | File | Issue |
|---|---|---|
| `token.js` (rewardUser) | actions/token.js:17 | Uses `jwt.decode()` instead of `jwt.verify()` — token signature not checked |
| `donate.js` (buildDonationTransaction, donateToCampaign) | actions/donate.js:17 | Same — token can be forged |
| `admin.js` (getUserTransactions) | actions/admin.js:15 | Same — token can be forged |

These handlers extract the user ID from the JWT without verifying the signature. An attacker can craft a JWT with any `x-hasura-user-id` and it will be accepted. However, Hasura itself verifies the JWT before forwarding to the action handler, so this is only exploitable if the action endpoints are called directly (bypassing Hasura).

---

## 4. Frontend Route Guard Validation

### Finding: No route guards exist

**Files:** `frontend/src/router/routes.ts`, `frontend/src/router/index.ts`

The Vue Router configuration defines admin routes (`/admin`, `/admin/contributions`, `/admin/campaigns`, `/admin/chats`) but has:
- No `beforeEach` navigation guard
- No `meta.requiresAdmin` properties
- No `beforeEnter` hooks on admin routes

Any authenticated user can navigate to `/admin/*` paths. The admin pages will render and attempt API calls. Some calls will succeed (e.g., `GET /api/admin/users` which has no admin check) while others will fail with 403 (e.g., `POST /api/chats` which does check).

### Finding: No admin check in auth store

**File:** `frontend/src/stores/auth.ts`

The auth store tracks `accountStatus` but provides no `isAdmin` computed property or getter. The `updateUserStatus()` method (lines 290-316) calls the vulnerable `PUT /api/users/:userId/status` endpoint without verifying the caller is admin.

---

## 5. Privilege Escalation Attack Path

The following attack can be performed by any authenticated user:

1. User registers normally and receives a valid JWT with `status: 'approved'`
2. User calls `PUT /api/users/{own-userId}/status` with body `{"status": "admin"}`
3. Backend updates their status to `admin` — no authorization check
4. User now has admin privileges in all Hasura row-level filters (`_exists` checks for `status = 'admin'`)
5. User can see all donations, all transactions, create/delete campaigns, etc.

**Verification:** This attack path was confirmed by code review of `backend/index.js:942-976`. The endpoint checks for a Bearer token in the Authorization header but never decodes or verifies it, and never checks if the calling user has admin privileges.

---

## 6. Summary of Findings

| Finding | Severity | Verified |
|---|---|---|
| Any user can escalate to admin via status endpoint | **CRITICAL** | Yes — code review confirmed no auth check |
| JWT not verified in Hasura Action handlers | **HIGH** | Yes — `jwt.decode()` confirmed in 3 files |
| Any user can update/delete any campaign via Hasura | **HIGH** | Yes — empty filter in metadata confirmed |
| Any user can read/modify/delete any message via Hasura | **HIGH** | Yes — empty filter in metadata confirmed |
| Any user can list all users with balances | **HIGH** | Yes — no admin check on endpoint |
| No frontend route guards on admin paths | **HIGH** | Yes — router config confirmed |
| Application logs accessible without auth | **MEDIUM** | Yes — commented TODO in code |
| All user records visible to any authenticated user | **MEDIUM** | Yes — empty SELECT filter confirmed |
