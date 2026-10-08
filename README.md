# LoanFinder — Loan Comparison & Bank Discovery Platform

A fintech demo for multi-category loan comparison, advertised-rate discovery, document readiness tracking, and city bank branch location — now backed by a real Express API with authentication and server-side saved offers.

> **Scope note:** rates are advertised starting rates from a small built-in catalogue (5 banks, 7 offers), not live feeds. Branch data is partly sample data. There is no live DigiLocker, KYC/OTP or P2P integration.

---

## Requirements

- **Node.js >= 20** (declared in `package.json` `engines`; developed on Node 24)
- npm 11+

## Quick Start (Run Locally)

```bash
npm install        # installs runtime + test dependencies
npm run db:init    # creates data/loanfinder.sqlite and seeds the catalogue
npm start          # serves API + frontend on http://localhost:8080
```

Open **http://localhost:8080** in your browser. The frontend must be served by this server — opening `index.html` directly via `file://` will not work because the app loads its data from `/api`.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port (`0` picks a free port; used by tests) |
| `NODE_ENV` | unset | Set to `production` to enable the `Secure` cookie flag and HSTS (requires HTTPS) |
| `AUTH_RATE_LIMIT_MAX` | `10` | Max `POST` requests per IP per minute on `/api/auth/*` (login/register brute-force protection) |

No `.env` file is required; nothing sensitive lives in environment variables.

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Run the API + frontend server |
| `npm test` | `pretest` (db:init + db:validate) then the full Playwright suite |
| `npm run db:init` | Create/migrate the database and re-seed reference data (non-destructive: never touches `users`, `sessions`, `saved_offers`) |
| `npm run db:validate` | Read-only 22-check database validation |
| `npm run db:extract` | Rebuild `data/loanfinder-data.json` from the frontend source |
| `npm run test:regression` / `test:map` / `test:p2p` | Focused test subsets |
| `npm run report:complete` / `report:status` | Generate PDF reports (uses devDependencies `pdfmake`/`pdf-lib`) |

## Architecture

```
server.js                 Express app: static frontend, security headers, auth rate limit
src/
  routes/api.js           Read-only catalogue API (banks, offers, branches, charges)
  routes/auth.js          register / login / logout / me
  routes/saved-offers.js  Auth-protected saved offers (GET, POST, DELETE)
  auth/                   scrypt password hashing, opaque session tokens, requireAuth
  db.js, migrate.js       SQLite handle (WAL, FK on) + ordered migrations
  rate-limit.js           In-memory fixed-window limiter
db/migrations/            0001 baseline schema, 0002 auth + saved offers
scripts/init-db.js        Non-destructive initializer/seeder
data/loanfinder.sqlite    Runtime database (gitignored, reproducible via db:init)
index.html, app.js, api.js Frontend (served by Express, talks to /api)
tests/                    Playwright suite (backend, frontend, auth, maps, a11y)
```

## API Reference

All endpoints return JSON. Errors use `{ "error": "message" }`.

### Catalogue (read-only)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ status: "ok" }` |
| GET | `/api/banks` | 5 banks |
| GET | `/api/loan-offers` | `?loan_type=Home Loan` filter; 7 offers |
| GET | `/api/loan-offers/:id` | 404 if unknown |
| GET | `/api/branches` | `?city=` and `?bank=` filters; 33 branches |
| GET | `/api/branches/:id` | 404 if unknown |
| GET | `/api/hidden-charges/offer/:offerId` | 35 charge rows |

Unsupported methods on these routes return **404** (intentional — there is nothing to create or modify on the catalogue).

### Authentication

| Method | Path | Success | Failure |
|---|---|---|---|
| POST | `/api/auth/register` | 201 + session cookie | 400 invalid email/password, 409 duplicate, 429 rate limited |
| POST | `/api/auth/login` | 200 + session cookie | 401 invalid credentials, 429 rate limited |
| POST | `/api/auth/logout` | 200, clears cookie | — |
| GET | `/api/auth/me` | 200 current user | 401 when anonymous |

Passwords are hashed with **scrypt** (N=16384, 16-byte salt, `timingSafeEqual` verify). Sessions are opaque 32-byte random tokens stored **hashed (SHA-256)** in `sessions`, valid 30 days, delivered in an `httpOnly`, `SameSite=Lax` cookie (`Secure` + HSTS in production).

### Saved offers (auth required — otherwise 401)

| Method | Path | Success | Failure |
|---|---|---|---|
| GET | `/api/saved-offers` | 200 rows for the current user only | 401 |
| POST | `/api/saved-offers` | 201 `{ offer_id }` | 400 bad body, 404 unknown offer, 409 duplicate, 429 n/a |
| DELETE | `/api/saved-offers/:id` | 200 | 400 invalid id, 401, 404 missing or **another user's row** |

Every query is scoped to the session's `user_id`; users can never see or delete each other's rows (asserted in `tests/api-auth.spec.js`).

### Security behaviours (Phase 2G)

- Security headers on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (+ HSTS when `NODE_ENV=production`).
- Malformed JSON → **400** `Invalid JSON body`; bodies over 100 KB → **413** `Payload too large` (never a misleading 500).
- `/api/auth` `POST`s are rate limited (default 10/min/IP → **429** with `Retry-After`).
- Static serving uses a path whitelist, so server source, `package.json` and the database are never served.

## Data & Migrations

- Schema lives in `db/migrations/` and is applied automatically at server start and by `db:init` (idempotent, recorded in `schema_migrations`).
- `npm run db:init` re-seeds **only** reference tables (`banks`, `loan_offers`, `branches`, `hidden_charges`, `meta`) from the canonical `data/loanfinder-data.json`; user accounts, sessions and saved offers survive. Saved offers referencing offers that no longer exist are purged as orphans.
- `data/loanfinder.sqlite*` is gitignored runtime data — safe to delete; `npm run db:init` recreates it.
- `npm test` always rebuilds and validates the database first (`pretest`).

## Testing

```bash
npm test
```

~110 Playwright tests, serial (single worker): backend API contract and parity, API hardening + auth (`api-auth.spec.js`), database lifecycle (`db-init.spec.js`), frontend auth/session/guest flows, matching regressions, map/geo behaviour, accessibility and mobile viewports. The suite runs against a real `node server.js` instance started by Playwright's `webServer`.

## Production Notes

- Run `NODE_ENV=production node server.js` behind an HTTPS reverse proxy; this turns on the `Secure` cookie flag and HSTS.
- The rate limiter is in-memory and per-process — fine for a single-instance prototype, replace with a shared store before scaling horizontally.
- Set `trust proxy` in `server.js` if you deploy behind a load balancer so `req.ip` reflects the client.
- Start with a process manager (systemd, pm2) or container; there is no built-in clustering.

## Implemented Architecture & UI Modules

| # | Screen / Module | Status | Features Included |
|---|----------------|:------:|-------------------|
| 1 | **Welcome / Landing Page** | Built | Hero value prop, stats counter, trust badges, quick search widget |
| 2 | **Login / Sign Up** | Built | Real authentication against the API: scrypt password storage, session cookie, auto-login on register, sign-out |
| 3 | **Sidebar & Navigation** | Built | Dark navy sidebar (`#0F172A`), active indicator pill, notification badge |
| 4 | **Multi-Loan Type Selection** | Built | Multi-select checkable cards for Home, Personal, Car, Education, Business, Gold Loans |
| 5 | **Loan Requirements Panel** | Built | Real-time amount range slider, tenure selector, income, employment type, credit score |
| 6 | **Lowest Rate Comparison Engine** | Built | Automatic sorting by lowest advertised starting rate, EMI calculation formula |
| 7 | **Best Offer Pinned Highlight** | Built | Emerald green border & badge (`#10B981`) showcasing the #1 ranked lowest rate |
| 8 | **Bank Details View** | Built | Comprehensive tabbed view: Overview, Documents, Eligibility, Branches |
| 9 | **Required Documents Checklist** | Demo only | Categorized checklist (ID, Address, Income, Tax, Property) with status badges & printable PDF. DigiLocker import uses sample documents, not the real DigiLocker API |
| 10 | **Bank Branch Locator & Map** | Built | Google-Maps-style map (MapLibre GL) with smooth zoom, drag-rotate, 3D pitch, a Map/Satellite switcher and a "fit all branches" control. Distances are calculated from your real location only when you grant geolocation permission. **Needs internet:** basemap tiles come from openfreemap.org (street) and Esri (satellite), so the background is blank without a connection; the branch list, IFSC codes and directions links still work |
| 11 | **Saved Offers** | Built | Server-backed bookmarks: saved offers survive refresh and are private to your account |
| 12 | **User Profile** | Built | Pre-filled applicant profile with personal & employment information |
