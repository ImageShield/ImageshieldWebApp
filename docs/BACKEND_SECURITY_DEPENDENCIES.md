# Backend Security Dependencies

After the API proxy removal, the browser calls the `/v1` backend directly with
bearer tokens. Security controls that the proxy never owned - and that the
frontend cannot enforce - now depend entirely on the backend. This checklist
names each one so they can be verified against the live API before the next
production deploy.

## Authentication & Token Lifecycle

| # | Control | Why it matters | How to verify |
|---|---------|----------------|---------------|
| 1 | **Access tokens are short-lived** (≤ 15 min) | A leaked `sessionStorage` token has a limited window. | Decode a live token's `exp` claim; confirm TTL ≤ 900 s. |
| 2 | **Refresh tokens are single-use (rotate)** | Prevents replay after a token is spent. The frontend's refresh mutex assumes this. | Call `POST /v1/auth/refresh` twice with the same token; second must 401. |
| 3 | **Spent refresh token invalidates the session** | Stops an attacker who captured a token from racing the legitimate holder. | After the second call above, confirm the session's access token also 401s. |
| 4 | **Refresh response includes both new tokens** | The frontend stores the pair atomically via `adoptTokens`. | Inspect the response body for `access_token` and `refresh_token`. |

## OTP / Phone Verification

| # | Control | Why it matters | How to verify |
|---|---------|----------------|---------------|
| 5 | **Per-phone rate limit on `POST /v1/auth/otp`** | Without the proxy's IP limiter, the backend is the only brake on OTP spam. | Send > 5 requests in 60 s for one phone; confirm 429 or equivalent. |
| 6 | **Challenge attempt cap (≤ 5 guesses)** | Prevents brute-forcing a 6-digit code. Dev API deletes at 5. | Submit 5 wrong codes to `POST /v1/auth/otp/{id}/verify`; confirm lock-out. |
| 7 | **Challenge expiry** | Old challenges should not be verifiable indefinitely. | Wait past the expected TTL (e.g. 10 min); confirm verify returns 404. |
| 8 | **Challenge bound to the requesting phone** | A challenge ID obtained for phone A must not verify a code sent to phone B. | Issue a challenge for phone A, submit the code from phone B; confirm rejection. |

## Authorization & Data Isolation

| # | Control | Why it matters | How to verify |
|---|---------|----------------|---------------|
| 9 | **No route accepts an actor identifier** | The bearer token is the sole identity. A user cannot request another user's data. | Confirm no `/v1` endpoint accepts a `user_id`, `account_id`, or similar param. |
| 10 | **Quiz response validation (version, keys, values)** | The browser submits answers directly; the backend must reject unknown keys or out-of-range values. | `POST /v1/quiz/responses` with a wrong `quiz_version`, an unknown key, and an invalid option value; confirm 400/422 for each. |
| 11 | **Profile update rejects unknown fields** | `PATCH /v1/me/profile` must not accept arbitrary keys. | Send a payload with an invented key (`{ "admin": true }`); confirm 400. |

## Transport & Headers

| # | Control | Why it matters | How to verify |
|---|---------|----------------|---------------|
| 12 | **CORS allows only the funnel's origin** | The browser sends bearer tokens cross-origin; a permissive `Access-Control-Allow-Origin` would let any page use them. | From an unrelated origin, send a preflight to any `/v1` endpoint; confirm the response does NOT echo the origin or use `*`. |
| 13 | **HTTPS only in production** | Tokens travel in `Authorization` headers; HTTP exposes them on the wire. | Confirm the production API rejects or redirects plain HTTP. |
| 14 | **No sensitive data in query strings** | Query strings appear in server logs and Referer headers. | Confirm tokens and PII are sent in headers or request bodies, never as query params. |

## Score Sharing (new)

| # | Control | Why it matters | How to verify |
|---|---------|----------------|---------------|
| 15 | **`GET /v1/me/score` requires authentication** | The score-token route forwards the visitor's bearer token to read their score; an unauthenticated read would let anyone mint a share token. | Call without `Authorization`; confirm 401. |
| 16 | **Score response is bound to the token holder** | The score returned must be the authenticated user's own, not a requested user's. | Authenticate as user A, read score; authenticate as user B, read score; confirm different results (or that no user-selection param exists). |

---

**Status**: Checklist produced. Each row requires manual verification against the
live (or staging) `/v1` API before the proxy removal ships to production.
