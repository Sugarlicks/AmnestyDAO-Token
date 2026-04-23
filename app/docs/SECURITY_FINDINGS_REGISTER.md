# Security Findings Register

**Date:** 2026-04-22
**Scope:** Full baseline security review — dependencies, access control, blockchain implementation (Task 5.3)
**Related reports:**
- [Dependency Scan Report](DEPENDENCY_SCAN_REPORT.md) (Task 5.1)
- [Access Validation Report](ACCESS_VALIDATION_REPORT.md) (Task 5.2)
- [Blockchain Implementation Report](BLOCKCHAIN_IMPLEMENTATION_REPORT.md) (Task 5.4)

---

## Findings Summary

| ID | Finding | Severity | Category | Status |
|---|---|---|---|---|
| SEC-01 | Privilege escalation via user status endpoint | **CRITICAL** | Access control | Open |
| SEC-02 | JWT not verified in Hasura Action handlers | **HIGH** | Authentication | Open |
| SEC-03 | Campaign UPDATE/DELETE lacks row-level security | **HIGH** | Access control | Open |
| SEC-04 | Message SELECT/UPDATE/DELETE lacks row-level security | **HIGH** | Access control | Open |
| SEC-05 | Admin user list endpoint has no admin check | **HIGH** | Access control | Open |
| SEC-06 | No frontend route guards on admin paths | **HIGH** | Access control | Open |
| SEC-07 | Dependency vulnerabilities (3 critical, 81 high) | **HIGH** | Dependencies | Partially mitigated |
| SEC-08 | Plutus validator does not enforce redeemer data | **MEDIUM** | Smart contract | Accepted (design) |
| SEC-09 | No Cardano address format validation | **MEDIUM** | Input validation | Open |
| SEC-10 | Error messages leak internal details | **MEDIUM** | Information disclosure | Open |
| SEC-11 | All user records visible to authenticated users | **MEDIUM** | Access control | Open |
| SEC-12 | Application logs accessible without auth | **MEDIUM** | Access control | Open |
| SEC-13 | Web mnemonic stored in localStorage | **MEDIUM** | Client-side security | Accepted (platform limit) |
| SEC-14 | `.env.dev` committed with testnet credentials | **LOW** | Credential management | Open |
| SEC-15 | Transaction confirmation race condition | **LOW** | Concurrency | Open |
| SEC-16 | No amount upper bound validation | **LOW** | Input validation | Open |
| SEC-17 | No transaction hash format validation | **LOW** | Input validation | Open |

---

## Detailed Findings

### SEC-01: Privilege Escalation via User Status Endpoint [CRITICAL]

**Location:** `backend/index.js:942-976`
**Description:** The `PUT /api/users/:userId/status` endpoint accepts any Bearer token without verifying it and has no admin authorization check. Any request with an Authorization header can set any user's status to `admin`.
**Attack path:** Authenticated user calls `PUT /api/users/{own-id}/status` with `{"status": "admin"}` → user gains admin privileges across the entire platform.
**Mitigation:** Add JWT verification and admin status check before processing the request. Verify that the decoded JWT user has `status = 'admin'` in the database.

### SEC-02: JWT Not Verified in Hasura Action Handlers [HIGH]

**Location:** `backend/actions/token.js:17`, `donate.js:17`, `admin.js:15`
**Description:** Three Hasura Action handlers use `jwt.decode()` (no signature verification) instead of `jwt.verify()`. An attacker could forge a JWT claiming any user ID.
**Mitigating factor:** Hasura verifies the JWT before forwarding to the action handler. The vulnerability is only exploitable if the Express `/actions/*` routes are directly accessible.
**Mitigation:** Replace `jwt.decode(token)` with `jwt.verify(token, JWT_SECRET)` in all three files. Additionally, verify that `/actions/*` routes are not accessible from outside the Docker network.

### SEC-03: Campaign UPDATE/DELETE Lacks Row-Level Security [HIGH]

**Location:** `backend/hasura/metadata/databases/default/tables/public_campaigns.yaml:64-82`
**Description:** Hasura `user` role permissions for UPDATE and DELETE on the `campaigns` table have empty filter objects `{}`, meaning any authenticated user can modify or delete any campaign.
**Mitigation:** Add row-level filter `{ created_by: { _eq: "X-Hasura-User-Id" } }` to UPDATE and DELETE permissions, with an admin exception via `_exists` subquery.

### SEC-04: Message SELECT/UPDATE/DELETE Lacks Row-Level Security [HIGH]

**Location:** `backend/hasura/metadata/databases/default/tables/public_messages.yaml:30,40,45`
**Description:** SELECT, UPDATE, and DELETE permissions for messages have empty filters. Any authenticated user can read, modify, or delete any message in any chat channel.
**Mitigation:** Add row-level filter `{ sender_id: { _eq: "X-Hasura-User-Id" } }` for UPDATE and DELETE. For SELECT, filter by chat membership or make all channel messages visible (depending on business intent).

### SEC-05: Admin User List Endpoint Has No Admin Check [HIGH]

**Location:** `backend/index.js:753-796`
**Description:** The `GET /api/admin/users` endpoint verifies the JWT but does not check if the calling user has admin status. Any authenticated user can list all users with their token balances.
**Mitigation:** Add admin status check: query the database for the calling user's status and return 403 if not admin.

### SEC-06: No Frontend Route Guards on Admin Paths [HIGH]

**Location:** `frontend/src/router/routes.ts`, `frontend/src/router/index.ts`
**Description:** Admin routes (`/admin/*`) have no navigation guards. Any authenticated user can navigate to admin pages. While some backend endpoints will reject unauthorized requests, others (SEC-01, SEC-05) will not.
**Mitigation:** Add a `beforeEach` navigation guard in `router/index.ts` that checks the user's admin status from the auth store before allowing navigation to `/admin/*` routes. Add an `isAdmin` computed property to the auth store.

### SEC-07: Dependency Vulnerabilities [HIGH]

**Location:** `frontend/package.json`, `backend/package.json`
**Description:** 131 vulnerabilities identified across all components (3 critical, 81 high, 35 moderate, 12 low). After running `npm audit fix`, reduced to 59 frontend + 57 backend remaining, almost entirely in the MeshSDK dependency tree.
**Key concerns:** `jws` HMAC signature bypass (affects JWT library), `node-forge` signature forgery, `protobufjs` arbitrary code execution.
**Mitigation applied:** `npm audit fix` applied to all components. Remaining vulnerabilities require breaking MeshSDK upgrade.
**Status:** Partially mitigated.

### SEC-08: Plutus Validator Does Not Enforce Redeemer Data [MEDIUM]

**Location:** `AmnestyDAO-Token/smart-contracts/validators/rewards/oracle_rewards.ak:6-14`
**Description:** The Plutus V3 validator only checks that the oracle's signature is present. It ignores the datum and redeemer entirely. The redeemer encodes the intended recipient and amount, but the validator does not verify that the transaction outputs match.
**Risk:** Oracle compromise means total treasury loss with no on-chain restrictions. Backend bugs could send incorrect amounts without on-chain detection.
**Status:** Accepted as design choice for MVP. The oracle is a trusted server controlled by the organization. For mainnet production with significant value, the validator should enforce redeemer data.

### SEC-09: No Cardano Address Format Validation [MEDIUM]

**Location:** `backend/actions/rewards.js:100`, `backend/actions/donate.js:53`
**Description:** User-provided Cardano addresses are checked for null but not validated as valid Bech32 addresses. Invalid addresses cause deep MeshSDK exceptions rather than clean validation errors.
**Mitigation:** Add Bech32 format validation before passing addresses to MeshSDK. Regex: `^addr((_test)?1)[a-z0-9]{50,}$`

### SEC-10: Error Messages Leak Internal Details [MEDIUM]

**Location:** `backend/actions/token.js:216`, `donate.js:129,247`, `admin.js:98`
**Description:** Raw error messages from blockchain operations are returned to clients, potentially revealing Blockfrost API details, wallet state, and UTxO structures.
**Mitigation:** Return generic error messages to clients. Log detailed errors server-side only.

### SEC-11: All User Records Visible to Authenticated Users [MEDIUM]

**Location:** `backend/hasura/metadata/databases/default/tables/public_users.yaml:76`
**Description:** The `user` role SELECT permission on the `users` table has an empty filter, allowing any authenticated user to query all user records.
**Mitigation:** If user directory is intended, restrict visible columns to non-sensitive fields. If not, add appropriate row-level filters.

### SEC-12: Application Logs Accessible Without Auth [MEDIUM]

**Location:** `backend/index.js:223-260`
**Description:** The `GET /api/logs` endpoint has a commented TODO for authentication. Logs are accessible without any auth check.
**Mitigation:** Add JWT verification and admin status check.

### SEC-13: Web Mnemonic Stored in localStorage [MEDIUM]

**Location:** `frontend/src/stores/auth.ts:186-191`
**Description:** On web (non-mobile), user wallet mnemonics are stored in `localStorage` which is accessible to any JavaScript running on the page. An XSS vulnerability could expose the mnemonic.
**Mitigating factor:** Mobile platforms use hardware-backed secure storage (Keychain/Keystore). This only affects web users.
**Status:** Accepted as platform limitation. Web wallets inherently face this tradeoff.

### SEC-14: `.env.dev` Committed with Testnet Credentials [LOW]

**Location:** `backend/.env.dev`
**Description:** A development environment file with pre-configured Blockfrost key and oracle mnemonic for preprod testnet is committed to the repository.
**Risk:** Low — these are testnet-only credentials with no mainnet value.

### SEC-15: Transaction Confirmation Race Condition [LOW]

**Location:** `backend/index.js:1140-1204`
**Description:** The `/api/tx/confirm` endpoint has a TOCTOU window between blockchain confirmation and database update. Concurrent requests for the same txHash could both proceed.
**Risk:** Low — database update is idempotent (CONFIRMED → CONFIRMED is harmless).
**Mitigation:** Add `WHERE transaction_status != 'CONFIRMED'` to the update query.

### SEC-16: No Amount Upper Bound Validation [LOW]

**Location:** `backend/actions/donate.js:47`
**Description:** Donation amounts are checked for `> 0` but have no upper bound. While the blockchain will reject insufficient balance, large amounts waste server resources.
**Mitigation:** Add a reasonable upper bound check.

### SEC-17: No Transaction Hash Format Validation [LOW]

**Location:** `backend/index.js:1141`
**Description:** The `/api/tx/confirm` endpoint accepts any string as a transaction hash without validating the expected 64-character hex format.
**Mitigation:** Add regex validation: `/^[0-9a-f]{64}$/i`

---

## Remediation Priority

### Immediate (before any production deployment)

1. **SEC-01** — Add admin auth check to status endpoint
2. **SEC-02** — Replace `jwt.decode()` with `jwt.verify()` in action handlers
3. **SEC-07** — Apply remaining dependency patches (especially `jws` JWT library)

### Short-term (within current development cycle)

4. **SEC-03** — Add row-level filters to campaign permissions
5. **SEC-04** — Add row-level filters to message permissions
6. **SEC-05** — Add admin check to user list endpoint
7. **SEC-06** — Add frontend route guards
8. **SEC-10** — Sanitize error messages returned to clients
9. **SEC-12** — Add auth to logs endpoint

### Medium-term (before scaling to larger user base)

10. **SEC-09** — Add address format validation
11. **SEC-11** — Restrict user table visibility
12. **SEC-15** — Add idempotency to tx confirmation
13. **SEC-08** — Evaluate redeemer enforcement in Plutus validator for mainnet

### Accepted risks

- **SEC-13** — Web localStorage limitation (no alternative without browser extension wallet)
- **SEC-14** — Testnet credentials in `.env.dev` (development convenience, no mainnet exposure)
- **SEC-16, SEC-17** — Low-severity input validation (blockchain provides natural bounds checking)
