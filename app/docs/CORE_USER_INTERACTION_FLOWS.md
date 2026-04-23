# Core User Interaction Flows

This document defines the core user interaction flows currently supported by the Human Rights DAO product, based on the live application structure in `frontend/`, `backend/`, and Hasura-backed data flows.

It is intended to serve as a shared product and engineering reference for:

- member-facing journeys
- admin-facing operational journeys
- role and state transitions
- backend touchpoints required to support each flow
- known implementation gaps where UI exists but behavior is incomplete

## Roles

### Member

A standard approved participant in the DAO. Members can:

- register with a wallet-backed account
- log in using wallet signature authentication
- browse and complete activism contributions
- browse and donate tokens to campaigns
- participate in chat channels they are allowed to access
- view wallet balances and transaction history
- update their own profile

### Admin

An approved participant with elevated status `admin`. Admins can do everything members can, plus:

- review and update user statuses
- monitor treasury and activity metrics
- create and edit contributions
- create and edit campaigns
- create and edit chat channels
- inspect broader DAO activity through the admin dashboard

## System Preconditions

These flows assume:

- the app launches through the splash screen
- secure storage is available for `mnemonic`, `user-id`, and `jwt`
- authentication uses Cardano wallet challenge signing
- CRUD data is primarily served through Hasura GraphQL
- auth, chat, profile, and blockchain-adjacent flows use the Express service

## Account States

User status drives access:

- `pending`: registration exists but account is not approved for login
- `approved`: standard member access
- `admin`: admin access plus member access
- `rejected`: registration exists but login is blocked

## Member Flows

### 1. First Launch and Entry Routing

Goal: determine whether the device should auto-login or send the user to registration.

Primary route:

- `/`
- `/splash`

Flow:

1. User opens the app.
2. Splash screen checks secure storage for `mnemonic`.
3. Splash screen checks secure storage for `user-id`.
4. If either value is missing, the user is routed to `/register`.
5. If both values exist, the app attempts wallet-based login.
6. On successful login, the app preloads contributions and campaigns.
7. User is routed to `/contributions`.

Failure and edge handling:

- if route changes mid-bootstrap, splash aborts the auto-login flow
- if stored credentials are invalid, user state is cleared and registration is shown
- if content preloading fails after login, the app still routes forward

### 2. Member Registration

Goal: create a wallet-backed account and persist the device credentials locally.

Primary route:

- `/register`

Inputs:

- display name
- email
- country
- language
- interests / affiliations
- optional profile image
- terms acceptance

System behavior:

1. User opens the registration dialog from the landing screen.
2. User enters required profile fields and accepts terms.
3. Client generates a new mnemonic locally.
4. Client derives a Cardano wallet and change address.
5. Client submits registration to `POST /api/register`.
6. Backend creates the user record with default status from the server-side flow.
7. Backend attempts an initial registration reward.
8. Client stores `user-id` and `mnemonic` in secure storage only after successful registration.
9. User remains in a post-registration state and later proceeds through login.

Backend touchpoints:

- `POST /api/register`
- reward mint/transfer attempt via backend reward action

Important notes:

- registration is wallet-first; there is no password flow
- country and language are validated by the backend
- a registration reward may succeed or fail independently of account creation
- the UI collects a single display name, while the backend stores first and last name fields

### 3. Login and Reauthentication

Goal: authenticate an existing device holder using stored mnemonic plus a server nonce.

Primary route:

- `/login`

Flow:

1. Client loads stored `mnemonic`.
2. Client loads stored `user-id`.
3. Client requests a login challenge from `POST /api/login/options`.
4. If account status is `pending`, the UI shows a waiting-for-approval state.
5. If account status is `approved` or `admin`, backend returns a nonce.
6. Client initializes the wallet from mnemonic.
7. Client signs the nonce using CIP-8 compatible wallet signing.
8. Client sends signature to `POST /api/login/verify`.
9. Backend verifies the signature against the stored wallet address.
10. Backend returns JWT plus profile payload.
11. Client persists JWT and loads approved users for chat/profile lookups.
12. User is routed into the authenticated app.

Failure and edge handling:

- unknown user blocks login
- expired or missing nonce blocks login
- invalid signature blocks login
- `rejected` users cannot proceed through the approved login path

### 4. Pending Approval Waiting State

Goal: clearly handle a registered user whose account is not yet approved.

Entry condition:

- login challenge request returns status `pending`

Flow:

1. User attempts login.
2. Backend reports non-approved status.
3. Client sets `accountStatus = pending`.
4. Login page shows a passive waiting state.
5. User must retry later after admin review.

### 5. Profile Update

Goal: allow members to maintain their own account profile.

Primary mechanism:

- authenticated API call from the auth store

Flow:

1. Member edits their profile fields in the relevant UI surface.
2. Client sends `PUT /api/users/:userId/profile` with JWT.
3. Backend verifies the caller is updating their own record.
4. Backend validates country and language if present.
5. Backend updates user fields and returns the canonical profile.
6. Client updates local auth state and locale settings.

Rules:

- users may only update their own profile
- language and country changes should propagate to locale state

### 6. Browse Contributions

Goal: help members discover activism actions relevant to them.

Primary routes:

- `/actions`
- `/contributions`

Flow:

1. Authenticated member opens the contributions list.
2. Client fetches active contributions from Hasura.
3. Query is filtered by user country when available.
4. Global contributions with `country = null` are also shown.
5. Client fetches the member’s completed contribution records.
6. UI marks already completed actions.
7. Member can open any contribution detail page.

Data behavior:

- only active contributions are shown in the member list
- results are ordered newest first
- completion state is derived from `user_contributions`

### 7. Contribution Detail and Completion

Goal: allow a member to complete an activism action and receive a token reward.

Primary route:

- `/contributions/:id`

Supported contribution types:

- `visit`
- `share`
- `scan`

Shared completion flow:

1. Member opens a contribution detail page.
2. Client loads the contribution record.
3. Client checks whether the member already completed it.
4. User triggers the action.
5. After the action-specific completion condition is met, client calls contribution completion logic.
6. System rewards the user first through `rewardUser`.
7. Only if reward succeeds, client inserts a `user_contributions` record.
8. Pending blockchain transaction hash is tracked for confirmation.
9. Balances and contribution state refresh.

Action-specific behavior:

- `visit`: app opens the external link, then completes after browser-close flow
- `share`: app opens the native share sheet, then completes after share returns
- `scan`: app scans a QR code and only completes if the scanned payload matches the contribution id

Constraints:

- the same contribution cannot be completed twice
- reward issuance is the gate before writing completion history
- if reward confirmation later fails, contribution record may already exist, so this flow should be monitored carefully

### 8. Browse Campaigns

Goal: let members discover campaigns they can support with tokens.

Primary route:

- `/campaigns`

Flow:

1. Member opens campaign list.
2. Client fetches active campaigns from Hasura.
3. Query is filtered by user country when available.
4. Global campaigns remain visible to all users.
5. Client fetches the member’s prior donations.
6. UI displays campaign progress, supporter count, and member donation metrics.
7. Member opens a campaign detail page to donate.

### 9. Campaign Donation

Goal: allow a member to donate DAO tokens from their wallet to a campaign.

Primary route:

- `/campaigns/:id`

Flow:

1. Member opens campaign detail.
2. Client loads campaign data and user balance.
3. Member chooses a donation amount.
4. Client validates amount is positive and not above available balance.
5. Client initializes the wallet.
6. Backend builds an unsigned donation transaction.
7. Client signs the transaction locally with the member wallet.
8. Client submits signed transaction through the Hasura action.
9. Backend submits the transaction and returns transaction metadata.
10. Client tracks pending transaction confirmation.
11. On confirmation, balances refresh.
12. Campaign list and user donation history refresh.

Progress states exposed in code:

- `building`
- `signing`
- `submitting`

Constraints:

- wallet signing is always client-side
- balance insufficiency blocks submission before signing
- donation completion depends on blockchain confirmation, not just mutation success

### 10. Chat Discovery and Channel Entry

Goal: allow members to see available channels and enter conversations.

Primary routes:

- `/chat`
- `/chat/:id`

Flow:

1. Member opens chat list.
2. Client fetches chats from `GET /api/chats`.
3. Client also fetches read timestamps from `GET /api/chats/read-timestamps`.
4. Public chats are shown broadly.
5. Private chats are only shown if the member is a participant.
6. Client subscribes to message streams per chat.
7. Member opens a specific chat room.
8. Client loads message history and sets current chat state.

Rules:

- public channels are broadly visible
- private channel access is enforced server-side
- unread counts are derived from subscription data plus read timestamps

### 11. Send Message and Read Tracking

Goal: support basic real-time conversation behavior for members.

Flow:

1. Member enters a chat room.
2. Client loads ordered messages for the channel.
3. Member submits a message.
4. Client sends `POST /api/chats/:chatId/messages`.
5. Backend validates access for private chats.
6. Message is persisted and the chat’s last-message state updates through subscription refresh.
7. When the user leaves or changes chats, client marks the previous chat as read.
8. Client sends `POST /api/chats/:chatId/read`.
9. Unread counts recalculate locally.

Constraints:

- empty messages are rejected
- private-chat participation is enforced before read/write operations

### 12. Wallet and Transaction Review

Goal: let members inspect token balances and their transaction history.

Primary route:

- `/wallet`

Flow:

1. Member opens wallet view.
2. Client refreshes on-chain balances through the blockchain store.
3. Client fetches member transaction history through `getUserTransactions`.
4. On admin accounts, treasury balance and treasury transactions are also loaded.
5. UI renders responsive desktop or mobile wallet surfaces.
6. When pending transactions resolve, balances are refreshed automatically.

Data shown:

- member token balance
- member transaction history
- treasury data for admins

### 13. Account Recovery

Goal: restore access from a mnemonic phrase.

Primary route:

- `/recovery`

Current state:

- recovery UI exists
- actual recovery logic is not implemented
- current behavior routes the user to `/login` without restoring secure storage state

Implication:

- recovery is an intended flow, not a completed production flow yet

## Admin Flows

### 14. Admin Access Entry

Goal: give admins access to operational surfaces after standard authentication.

Primary routes:

- `/admin`
- `/admin/contributions`
- `/admin/campaigns`
- `/admin/chats`

Entry rule:

- user must authenticate with status `admin`

Observed behavior:

- admin-specific pages exist in routing
- admin capabilities are partially gated in frontend using `auth.user.status === 'admin'`
- backend strongly gates some actions, especially chat creation

Important note:

- route-level guards are not evident in the current route file, so admin surface protection relies heavily on page logic and backend authorization

### 15. Review and Update User Status

Goal: let admins approve, reject, or elevate users.

Primary route:

- `/admin`

Flow:

1. Admin opens dashboard.
2. Client loads all users with statuses from `GET /api/admin/users`.
3. Client also loads token balances for dashboard display.
4. Users are shown with profile, status, and balance data.
5. Admin changes a user status in the table.
6. Client sends `PUT /api/users/:userId/status`.
7. Backend updates the user record.
8. UI updates locally and notifies success.
9. If update fails, UI reloads canonical user data.

Statuses exposed in admin UI:

- `approved`
- `rejected`
- `admin`

Important note:

- backend accepts `pending` too, but the current admin UI options shown in the code emphasize approved, rejected, and admin

### 16. Monitor DAO Health and Treasury

Goal: give admins a control-plane view of DAO activity.

Primary route:

- `/admin`

Dashboard includes:

- total approved/admin users
- total completed actions
- total donations
- total messages
- treasury balance
- treasury inflow and outflow by selected period
- treasury transaction search and filtering
- token distribution and activity reporting

Flow:

1. Admin opens dashboard.
2. Client loads treasury balance and treasury transactions.
3. Client loads users and token balances.
4. UI aggregates metrics into cards, charts, and transaction tables.
5. Admin can change time periods and search transactions.

### 17. Create and Edit Contributions

Goal: let admins manage the action catalog members can complete.

Primary route:

- `/admin/contributions`

Flow:

1. Admin opens contribution management.
2. Existing contributions are loaded into a table.
3. Admin may search or refresh.
4. Admin opens create or edit dialog.
5. Admin edits metadata such as title, description, type, reward, external link, deadline, target participants, locale targeting, image, and active state.
6. Admin saves changes.
7. Data is persisted through GraphQL-backed contribution management logic.
8. Member-facing lists will subsequently reflect active records and locale filters.

Supported admin operations in UI:

- create contribution
- edit contribution
- activate/deactivate contribution
- delete contribution
- CSV import

Member-facing impact:

- active contributions become eligible for browsing
- contribution type determines how completion is executed on device

### 18. Create and Edit Campaigns

Goal: let admins manage donation destinations.

Primary route:

- `/admin/campaigns`

Flow:

1. Admin opens campaign management.
2. Existing campaigns are loaded into a table.
3. Admin may search or refresh.
4. Admin opens create or edit dialog.
5. Admin edits title, description, details, goal, category, URL, deadline, locale targeting, image, and active state.
6. Admin saves changes.
7. Campaign records are persisted.
8. Member-facing campaign lists update according to `isActive` and locale targeting.

Supported admin operations in UI:

- create campaign
- edit campaign
- activate/deactivate campaign
- delete campaign
- CSV import

### 19. Create and Edit Chat Channels

Goal: let admins manage channel availability.

Primary route:

- `/admin/chats`

Flow:

1. Admin opens channel management.
2. Existing channels are loaded into a table.
3. Admin may search or refresh.
4. Admin opens create or edit dialog.
5. Admin sets channel name, image, and privacy mode.
6. Client sends create or update request to the Express service.
7. Backend enforces admin status for channel creation.
8. Client refreshes the channel list after mutation.

Supported implemented operations:

- create chat channel
- edit chat channel

Known gap:

- delete UI exists, but chat deletion is not implemented in the store and no delete endpoint is visible in the current backend code

Private-channel behavior:

- creation currently auto-adds the creating admin as a participant
- broader participant management is not exposed in the current admin UI

## Cross-Cutting Flows

### 20. Localization and Country Targeting

Goal: tailor content visibility and user experience by region and language.

Flow behavior:

1. User selects country and language during registration.
2. User profile stores both values.
3. Locale store syncs from profile after login and profile updates.
4. Contributions and campaigns are filtered by user country where possible.
5. Global records with no country restriction remain visible to all users.

Implications:

- country targeting is a key part of member content discovery
- admins can define content as global or country-specific

### 21. Blockchain Confirmation Tracking

Goal: keep UI state aligned with eventual blockchain settlement.

Applies to:

- registration rewards
- contribution rewards
- campaign donations

Flow:

1. Backend or action layer returns a Cardano transaction hash.
2. Client adds hash to pending transaction tracking.
3. Client calls confirmation logic through the blockchain store.
4. On confirmation, balances refresh.
5. UI reflects the settled token state.

Risk area:

- some product records are written before final blockchain confirmation, so operational monitoring should account for partial success states

## Known Gaps and Ambiguities

### Implemented but incomplete

- mnemonic recovery UI exists, but recovery logic is not implemented
- chat delete controls exist in admin UI, but delete behavior is not implemented end-to-end

### Authorization and routing risks

- no explicit route guard is visible in `frontend/src/router/routes.ts`
- admin protection appears to rely on page logic and backend checks rather than a centralized route guard

### Data-model mismatches

- registration UI centers on `displayName`, while backend registration requires and stores first and last name semantics
- product language should clarify whether a single chosen name or split legal/profile name model is intended

## Recommended Use of This Document

Use this file as the baseline when:

- designing new screens or refining navigation
- adding route guards and permission enforcement
- implementing missing recovery and chat deletion flows
- aligning frontend UX with backend data contracts
- writing QA test cases for member and admin journeys
