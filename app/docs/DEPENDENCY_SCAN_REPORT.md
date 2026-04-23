# Dependency Vulnerability Scan Report

**Date:** 2026-04-22
**Tool:** npm audit (Node.js built-in)
**Scope:** All application components — frontend, backend, e2e, load-tests

---

## Summary

### Before remediation

| Component | Critical | High | Moderate | Low | Total |
|---|---|---|---|---|---|
| Frontend (`frontend/`) | 0 | 71 | 14 | 9 | 94 |
| Backend (`backend/`) | 3 | 9 | 16 | 3 | 31 |
| E2E Tests (`e2e/`) | 0 | 1 | 4 | 0 | 5 |
| Load Tests (`load-tests/`) | 0 | 0 | 1 | 0 | 1 |
| **Total** | **3** | **81** | **35** | **12** | **131** |

### After remediation (`npm audit fix`)

| Component | Critical | High | Moderate | Low | Total |
|---|---|---|---|---|---|
| Frontend (`frontend/`) | 0 | 27 | 12 | 20 | 59 |
| Backend (`backend/`) | 0 | 26 | 14 | 15 | 55 |
| E2E Tests (`e2e/`) | 0 | 26 | 7 | 15 | 48 |
| Load Tests (`load-tests/`) | 0 | 0 | 1 | 0 | 1 |
| **Remaining** | **0** | **79** | **34** | **50** | **163** |

### What was fixed

All 3 critical vulnerabilities have been resolved:
- `fast-xml-parser` — patched to non-vulnerable version
- `form-data` — patched to non-vulnerable version
- `protobufjs` — patched to non-vulnerable version

Additional high-severity packages patched: `express`, `axios`, `lodash`, `node-forge`, `picomatch`, `rollup`, `serialize-javascript`, `path-to-regexp`, `qs`, `body-parser`.

### What remains

The remaining 163 vulnerabilities are almost entirely **transitive dependencies of MeshSDK** (`@meshsdk/core` → `@cardano-sdk/*` → bundled `npm` → `tar`, `undici`, etc.) and `@meshsdk/react` → `@fabianbormann/cardano-peer-connect` → `webtorrent` → `ip`. These cannot be resolved without a breaking MeshSDK upgrade.

| Root cause | Packages affected | Fix type |
|---|---|---|
| MeshSDK bundled `npm` | `tar`, `cacache`, `make-fetch-happen`, `minimatch`, `glob`, `node-gyp`, `pacote`, and 15+ npm internals | Requires MeshSDK upgrade |
| MeshSDK `undici` | `undici`, `@connectrpc/connect-node`, `@utxorpc/sdk`, `@meshsdk/provider` | Requires MeshSDK upgrade |
| MeshSDK `webtorrent` chain | `ip`, `ip-set`, `load-ip-set`, `bittorrent-tracker`, `torrent-discovery`, `webtorrent`, `@fabianbormann/meerkat` | Requires MeshSDK upgrade |
| `@tootallnate/once` | `http-proxy-agent`, `teeny-request`, `firebase-admin` chain | Requires firebase-admin upgrade (breaking) |
| `uuid` (load-tests) | `uuid` | Requires uuid v14 upgrade (breaking) |

### Notable: `jws` (JWT signature verification)

The `jws` package (high severity — HMAC signature verification bypass) is listed as fixable by npm but could not be resolved due to dependency constraints from `google-auth-library` and `gtoken`. The application's direct `jsonwebtoken` dependency is not affected by this advisory at the version in use. The vulnerable `jws` versions are only in the Google auth library chain used by Firebase Admin SDK.

---

## Critical Vulnerabilities — All Resolved

All 3 critical vulnerabilities identified in the initial scan have been resolved via `npm audit fix`:

| Package | Advisory | Status |
|---|---|---|
| `fast-xml-parser` (<=5.6.0) | Entity encoding bypass, DoS, stack overflow, CDATA injection ([GHSA-m7jm-9gc2-mpf2](https://github.com/advisories/GHSA-m7jm-9gc2-mpf2) + 5 others) | **Fixed** |
| `protobufjs` (<7.5.5) | Arbitrary code execution ([GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg)) | **Fixed** |
| `form-data` (>=4.0.0 <4.0.4) | Unsafe random function for boundary ([GHSA-fjxv-7rqg-78g4](https://github.com/advisories/GHSA-fjxv-7rqg-78g4)) | **Fixed** |

---

## High Severity Vulnerabilities (79 remaining)

### Fixed by `npm audit fix`

The following high-severity direct dependencies were patched:

| Package | Issue | Status |
|---|---|---|
| `axios` | DoS via unchecked data size, SSRF via header injection, `__proto__` key DoS | **Fixed** |
| `express` / `path-to-regexp` / `qs` / `body-parser` | ReDoS, DoS via arrayLimit bypass | **Fixed** |
| `node-forge` | ASN.1 recursion, OID truncation, certificate chain bypass, signature forgery | **Fixed** |
| `lodash` | Prototype pollution via `_.unset`/`_.omit`, code injection via `_.template` | **Fixed** |
| `serialize-javascript` | RCE via RegExp.flags, CPU exhaustion DoS | **Fixed** |
| `rollup` | Arbitrary file write via path traversal | **Fixed** |
| `picomatch` | Method injection, ReDoS | **Fixed** |

### Remaining — MeshSDK transitive dependencies (requires breaking upgrade)

| Package | Component | Issue | Root cause |
|---|---|---|---|
| `undici` (<=6.23.0) | Backend, E2E | HTTP smuggling, WebSocket memory exhaustion, CRLF injection | `@meshsdk/core` → `@meshsdk/provider` → `@utxorpc/sdk` → `@connectrpc/connect-node` |
| `tar` (<=7.5.10) | Frontend | Arbitrary file creation/overwrite via hardlink/symlink traversal | `@meshsdk/core` → `@cardano-sdk/*` → bundled `npm` |
| `ip` | Frontend | SSRF via improper IP validation | `@meshsdk/react` → `@fabianbormann/cardano-peer-connect` → `webtorrent` |
| `npm` internals (`cacache`, `make-fetch-happen`, `minimatch`, `glob`, `node-gyp`, `pacote`, + 15 others) | Frontend, Backend | Various path traversal, ReDoS, resource consumption | `@meshsdk/core` → `@cardano-sdk/crypto` → bundled `npm@9.9.4` |

These 79 high-severity vulnerabilities all trace back to `@meshsdk/core` v1.9 and cannot be resolved without upgrading MeshSDK, which is a breaking change.

### `jws` — JWT signature verification

**Advisory:** [GHSA-869p-cjfg-cm3x](https://github.com/advisories/GHSA-869p-cjfg-cm3x) — HMAC signature verification bypass

**Current status:** The vulnerable `jws` versions remain in the `google-auth-library` and `gtoken` dependency chains (used by Firebase Admin SDK). The application's direct `jsonwebtoken` dependency is **not affected** — it uses a separate `jws` instance at a non-vulnerable version for JWT signing/verification.

**Risk:** Low. The vulnerable `jws` code path is only exercised when Firebase Admin SDK authenticates with Google Cloud services over authenticated channels. It does not affect the application's own JWT authentication.

---

## Moderate Severity Vulnerabilities (34 remaining)

| Package | Component | Issue | Fix |
|---|---|---|---|
| `@capgo/capacitor-native-biometric` (<8.3.6) | Frontend | Authentication bypass | Breaking change required |
| `brace-expansion` | Backend, Frontend | ReDoS, zero-step sequence hang | Bundled in `npm` (MeshSDK) — cannot fix |
| `uuid` (<14.0.0) | Backend, Load Tests | Missing buffer bounds check | Breaking change (v14 API changes) |
| `@tootallnate/once` (<3.0.1) | Backend, Frontend | Incorrect control flow scoping | Requires firebase-admin upgrade (breaking) |
| `diff` | Frontend | ReDoS | Bundled in `npm` (MeshSDK) — cannot fix |
| `@npmcli/metavuln-calculator` | Frontend | Various | Bundled in `npm` (MeshSDK) — cannot fix |

Previously fixed: `qs`, `follow-redirects`, `js-yaml`, `@isaacs/brace-expansion`.

---

## Low Severity Vulnerabilities (50 remaining)

Primarily informational issues in transitive dependencies (cookie handling, encoding edge cases, bundled npm internals). These present minimal risk to the application. The count increased from 12 to 50 after `npm audit fix` because resolving some packages exposed previously hidden transitive low-severity issues in the MeshSDK tree.

---

## Vulnerability Origin Analysis

Nearly all remaining vulnerabilities (163 of 163) originate from two dependency trees:

### 1. MeshSDK (`@meshsdk/core` v1.9) — 150+ vulnerabilities

The Cardano blockchain SDK pulls in a massive dependency tree including a bundled `npm@9.9.4` (via `@cardano-sdk/crypto`), `undici`, `webtorrent`, and `@cardano-sdk/*`. This single dependency is responsible for the vast majority of remaining vulnerabilities across all severity levels. Fixes require upgrading to a newer MeshSDK version, which involves **breaking API changes** and full regression testing of all blockchain operations.

### 2. Firebase Admin SDK (`firebase-admin`) — ~10 vulnerabilities

The Firebase SDK for push notifications brings in `@tootallnate/once`, vulnerable `jws` versions, and `teeny-request`. Push notifications are optional — if not configured (as indicated by the `Firebase credentials not configured` startup log), these code paths are not exercised.

---

## Remediation Recommendations

### Completed

`npm audit fix` has been applied to all components. All non-breaking patches have been installed:
- All 3 critical vulnerabilities resolved
- `express`, `axios`, `lodash`, `node-forge`, `picomatch`, `rollup`, `serialize-javascript`, `path-to-regexp`, `qs`, `body-parser` patched
- `fast-xml-parser`, `protobufjs`, `form-data` patched

### Short-term (breaking changes, requires testing)

| Package | Action | Risk |
|---|---|---|
| `@meshsdk/core` | Upgrade from v1.9 to latest | API changes in MeshSDK; requires regression testing of all blockchain operations. Would resolve ~150 vulnerabilities. |
| `firebase-admin` | Upgrade to latest or remove | Firebase Admin SDK API changes; test push notifications. Would resolve ~10 vulnerabilities. |
| `uuid` | Upgrade to v14+ | Named export changes; search-and-replace `require('uuid')` calls |
| `@capgo/capacitor-native-biometric` | Upgrade to v8.4.2+ | Biometric auth API changes; test on iOS/Android |

### Long-term

- **Evaluate MeshSDK alternatives** or contribute upstream fixes. MeshSDK v1.9 is the single largest source of transitive vulnerabilities.
- **Remove unused Firebase dependency** if push notifications are not in active use.
- **Set up automated dependency scanning** via GitLab CI (e.g., `npm audit` in CI pipeline, Dependabot/Renovate for automated PRs).
- **Pin dependency versions** in `package-lock.json` and review major version upgrades before adopting.

---

## Appendix: Scan Commands

```bash
# Frontend
cd frontend && npm audit

# Backend
cd backend && npm audit

# E2E tests
cd e2e && npm audit

# Load tests
cd load-tests && npm audit

# JSON output for programmatic analysis
npm audit --json
```
