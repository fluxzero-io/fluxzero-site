# Embedded Feedback — Plan

This document outlines the plan and architecture for the embedded text‑selection feedback feature and the associated GitHub authentication flow using a GitHub App. The goal is to let readers select text, click a small prompt, write feedback, and submit it to GitHub Discussions — while keeping permissions tight and avoiding server‑side session storage.

## Scope

- Selection prompt near highlighted text that opens a small compose popup.
- Display of existing page‑scoped discussions with inline anchors and a floating list.
- GitHub authentication via a GitHub App using user‑to‑server OAuth tokens.
- No backend sessions or databases; tokens are stored only in httpOnly cookies.
- If not authenticated, users cannot submit; they see a “Sign in with GitHub” button.

## Implementation Plan

1) Selection & Compose
- Add a small prompt when user selects 3+ characters.
- On click, wrap selection in a temporary highlight and open a compose popup with:
  - Quoted selection preview
  - Textarea for feedback
  - Actions: Cancel, Submit (or Sign in with GitHub when unauthenticated)
- Disable submit for unauthenticated users and show a login button instead.

2) Feedback List & Inline Indicators
- Display open discussions for the current slug in a compact floating list.
- Anchor indicators next to matched selected text on the page; clicking opens a details popup.
- After submit, refresh the list and highlights.

3) API for Discussions
- GET `/api/feedback?slug=…`: fetch discussions from GitHub GraphQL (mocked locally).
- POST `/api/feedback`: create a new discussion (or add a comment) using the authenticated user token.
  - 401 if unauthenticated.

4) GitHub Auth (GitHub App, cookie‑only)
- Endpoints (no server‑side storage):
  - GET `/api/auth/github/login`
    - Create CSRF `state` cookie and optional `returnTo` cookie; redirect to GitHub OAuth authorize URL.
  - GET `/api/auth/github/callback`
    - Verify `state`, exchange `code` for user‑to‑server token, seal into an encrypted httpOnly cookie, redirect to `returnTo`.
  - GET `/api/auth/github/me`
    - Read token from cookie, call GitHub `/user`, return `{ login, avatar_url }` (401 if missing/invalid).
  - POST `/api/auth/github/logout`
    - Expire auth cookies.

## GitHub Auth (Details)

### Why a GitHub App
- Least privilege: Discussions (Read/Write) and Metadata (Read) limited to the repo where the app is installed.
- Users post as themselves via user‑to‑server tokens.
- Revocation/install management per‑repo.

### Permissions
- Repository permissions:
  - Discussions: Read and write
  - Metadata: Read only
- Enable “User authorization callback” for user‑to‑server tokens.
- Install the app on `fluxzero-io/fluxzero-site`.

### Cookie‑Only Sessions
- No KV/DB. All auth state lives in sealed httpOnly cookies.
- Cookies (names are examples):
  - `fx_gh_state`: random nonce for CSRF (HttpOnly, Secure, SameSite=Lax, Path=/api/auth/github)
  - `fx_return_to`: original path to return to after auth (HttpOnly, Secure, SameSite=Lax)
  - `fx_gh_auth`: encrypted token blob (HttpOnly, Secure, SameSite=Lax, Path=/api)
    - `{ access_token, refresh_token, expires_at, token_type }`
- Use WebCrypto AES‑GCM to seal/unseal the token blob. The key is provided as `COOKIE_SECRET`.

### Token Refresh
- If `expires_at` has passed, refresh the token with GitHub OAuth using `refresh_token` and update the cookie.
- The client never sees tokens; only the server reads/writes the cookie.

### Client UX
- In the compose popup:
  - On open, call `/api/auth/github/me`.
  - If 401: hide Submit and show “Sign in with GitHub” button.
  - On click: save the draft (textarea contents + selected quote) to `sessionStorage`, redirect to `/api/auth/github/login?returnTo=<slug>`.
  - After redirect back: optionally restore the draft and resubmit; in the first iteration, we can stop at showing the authenticated state and letting users submit manually.

## Phased Delivery

Phase 1 — UI gating & docs (this change)
- Add docs and plan (this file).
- Update composer UI to block submit when unauthenticated and show a GitHub login button that links to `/api/auth/github/login`.
- Add `/api/auth/github/me` endpoint stub returning 401 until auth is implemented.

Phase 2 — Auth endpoints (cookie‑only)
- Implement `/api/auth/github/login` and `/api/auth/github/callback` per GitHub App OAuth flow.
- Implement `/api/auth/github/logout`.
- Implement `/api/auth/github/me` to call GitHub `/user` with the sealed token.

Phase 3 — Discussions write path
- Update `/api/feedback` POST to use the user token to call GitHub GraphQL (create discussion / add comment).
- Handle token refresh when expired; rewrite cookie upon refresh.
- Add light error handling in the composer.

## Security Notes
- Cookies: `Secure`, `HttpOnly`, `SameSite=Lax`, narrow `Path` where possible.
- Verify `state` on callback; consider PKCE for added protection.
- Do not log tokens or the sealed cookie contents.
- Keep encrypted cookie payload under 4KB.

