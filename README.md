<div align="center">

# 🏦 LoanFinder

**Compare advertised loan rates, discover bank branches, and explore a peer-to-peer lending flow — all in one browser app.**

A transparent loan-comparison and bank-discovery prototype for the Indian market, built with a framework-free frontend and a small Express + SQLite backend.

[![Node](https://img.shields.io/badge/Node-%E2%89%A5%2020-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS%20%C2%B7%20No%20build-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](#technology-stack)
[![Tests](https://img.shields.io/badge/Tests-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)](./tests)
[![Status](https://img.shields.io/badge/Status-Prototype%20%2F%20Demo-2563eb?style=flat-square)](#prototype-limitations--safety-disclaimer)

</div>

---

> **Note on data:** Bank rates shown here are *advertised starting rates* from a small built-in catalogue — not live feeds and not personalised quotes. Nothing in this project is financial advice.

---

## 📑 Table of Contents

- [Demo Login Credentials](#-demo-login-credentials)
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Screenshots](#-screenshots)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [How Loan Comparison & Matching Work](#-how-loan-comparison--matching-work)
- [Authentication & Saved Offers](#-authentication--saved-offers)
- [Branch Discovery & Map-Data Transparency](#-branch-discovery--map-data-transparency)
- [API Overview](#-api-overview)
- [Automated Testing](#-automated-testing)
- [Installation & Local Setup](#-installation--local-setup)
- [Project Structure](#-project-structure)
- [Prototype Limitations & Safety Disclaimer](#-prototype-limitations--safety-disclaimer)
- [Future Improvements](#-future-improvements)

---

## 🔑 Demo Login Credentials

Use these credentials to sign in to the local demo:

- **Email:** `demo@loanfinder.in`
- **Password:** `demo1234`

> 🔒 This is a **demo login for local use only** at `http://localhost:8080`. The account exists solely to persist saved offers in the prototype — no real financial or personal data is involved.

---

## 🔎 Overview

Choosing a loan usually means juggling a dozen bank websites, guessing at fees, and never quite knowing which offer actually fits. **LoanFinder** collapses that into one screen:

1. **Pick** the loan type(s) you care about and enter a few details.
2. **Compare** the advertised offers side by side, ranked by lowest starting rate with an EMI calculated for your exact amount and tenure.
3. **Check** eligibility against each bank's published rules and review the fine print / hidden charges.
4. **Find** the nearest branch on an interactive map and follow the document checklist.

Alongside the comparison engine, LoanFinder ships a **simulated P2P marketplace** where the demo's "borrower" and "lender" are treated as equal halves of the product — browse funding requests, view a portfolio, and chat, entirely locally.

> 🎯 **The problem it solves:** opaque, fragmented loan shopping. LoanFinder makes the trade-offs explicit — rate, EMI, fees, eligibility and branch access — in a single, comparable view.

---

## ✨ Key Features

| # | Feature | What it does |
|---|---------|--------------|
| 1 | **Multi-loan comparison** | Select Home / Personal (and coming-soon categories) and compare offers across 5 real Indian banks (7 published offers). |
| 2 | **Lowest-rate ranking** | Sorts offers by advertised starting rate and pins the #1 pick with an emerald "Best Offer" highlight. |
| 3 | **Live EMI calculator** | Standard amortisation formula recalculates the monthly EMI for your amount and tenure. |
| 4 | **Eligibility checker** | Compares your credit score, monthly income and employment type against each offer's published minimums. |
| 5 | **Hidden-charge transparency** | A per-offer fine-print breakdown (35 charge rows) so fees aren't a surprise. |
| 6 | **Bank details view** | Tabbed Overview / Documents / Eligibility / Branches for every offer. |
| 7 | **Document checklist** | A categorised readiness checklist with status badges and a client-side generated PDF. |
| 8 | **Branch locator** | MapLibre GL map (Google-Maps-style zoom, rotate, 3D pitch, Map/Satellite toggle) with IFSC, hours and directions. |
| 9 | **Accounts & saved offers** | Real registration/login backed by the API; bookmarks persist per account and survive refresh. |
| 10 | **P2P lending demo** | A simulated borrow/lend marketplace with request posting, funding, portfolio and chat. |

---

## 🖼️ Screenshots

> 📌 This repository does **not** currently ship any screenshots. Rather than fabricate them, run the app locally (`npm start`) and explore the landing page, comparison dashboard, branch map and P2P marketplace for yourself. If you add screenshots later, place them in a `docs/` folder and reference them here.

---

## 🛠️ Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Frontend** | Vanilla HTML / CSS / JavaScript | No framework, no build step. `index.html`, `styles.css`, `app.js`, `api.js`. |
| **Backend** | Node.js ≥ 20 + Express 5 | Static hosting, REST API, security headers. |
| **Database** | SQLite via `better-sqlite3` | WAL journal, foreign keys on, no ORM. |
| **Auth** | Node `crypto` scrypt | Password hashing + opaque session tokens. |
| **Maps** | MapLibre GL (Leaflet fallback) | Free openfreemap & Esri vector/raster tiles. |
| **Icons / PDF** | Vendored Lucide icons · `pdf-lib` | Fully offline icon set and client-side PDF export. |
| **Testing** | Playwright + Chromium | Runs against a real server instance. |

- **Engines:** Node `>= 20` (developed on Node 24).
- **Runtime dependencies:** `express`, `better-sqlite3`. Everything else is dev-only.

---

## 🏗️ System Architecture

Three tiers in a single process: a static browser frontend, an Express API, and a SQLite database seeded from one canonical JSON snapshot.

```text
                    ┌────────────────────────────────────────────┐
                    │  Browser                                   │
                    │  index.html · app.js · api.js · styles.css │
                    │  (vanilla JS, no build step)               │
                    └───────────────────┬────────────────────────┘
                                        │  fetch (same-origin,
                                        │  relative URLs, session cookie)
                                        ▼
                    ┌────────────────────────────────────────────┐
                    │  Express  server.js                        │
                    │  ├─ security headers + JSON body parser    │
                    │  ├─ /api/auth/*        → rate limit + auth │
                    │  ├─ /api/saved-offers  → requireAuth       │
                    │  └─ /api/*             → read-only catalogue│
                    └───────────────────┬────────────────────────┘
                                        │  parameterized SQL
                                        ▼
                    ┌────────────────────────────────────────────┐
                    │  SQLite  (better-sqlite3, WAL, FK ON)      │
                    │  src/db.js + src/migrate.js                │
                    │  seeded by scripts/init-db.js from         │
                    │  data/loanfinder-data.json                 │
                    └────────────────────────────────────────────┘
```

The frontend loads its catalogue from the REST API at boot (with a loading state and a Retry action on failure) — there is deliberately **no hardcoded fallback dataset**, so what you see always comes from the database.

---

## 🧮 How Loan Comparison & Matching Work

**1. Filter → 2. Rank → 3. Score → 4. Explain.**

- **Filter:** only offers matching the selected loan type(s) are considered.
- **Rank:** offers are ordered ascending by **advertised starting interest rate**.
- **EMI:** the monthly instalment is computed with the standard amortisation formula:

```text
        P · r · (1 + r)^n
EMI  =  ─────────────────          where  r = annualRate / 12 / 100
          (1 + r)^n − 1                    n = tenure in months
```

- **Score:** each offer gets a match score from your **credit score**, **monthly income** and **employment type** versus that offer's published minimums (`min_credit_score`, `min_monthly_income`, `allowedEmployment`).
- **Explain:** the eligibility checker returns per-offer reasons and tips, so a "not eligible" result tells you *why*.

**Worked example** — Home Loan · ₹35,00,000 · 20 years · ₹9,50,000 income · Salaried · 780 score:

| Rank | Bank | Advertised rate | Match |
|:----:|------|:---------------:|:-----:|
| 🥇 | State Bank | **7.85% p.a.** | 100% |
| 🥈 | HDFC Bank | 8.1% p.a. | 73% |
| 🥉 | Axis Bank | 8.4% p.a. | — |

The full comparison lists all available Home Loan offers (`7.85, 8.1, 8.35, 8.4, 8.45`); the top card shows an estimated EMI of **₹28,950/mo**, a 0.25% processing fee, a 30-year max tenure and a ₹1.5 Cr ceiling.

---

## 🔐 Authentication & Saved Offers

The demo ships a **real, self-contained auth flow** backed by the API:

- **Registration / login** validate the email format and require an 8+ character password.
- Passwords are hashed with **scrypt** (N=16384, r=8, p=1, 16-byte salt) and verified with `timingSafeEqual`.
- Sessions are **opaque 32-byte tokens**; only their **SHA-256 hash** is stored, so a database dump can't hand out live sessions.
- The session rides in an **`httpOnly`, `SameSite=Lax` cookie** (with `Secure` + HSTS only when `NODE_ENV=production`), valid for 30 days and surviving a server restart.
- **Saved offers** are stored server-side and scoped to the signed-in account — every query filters by `user_id`, duplicates are blocked by a `UNIQUE(user_id, offer_id)` constraint, and users can never read or delete another account's rows.

> Accounts here exist only to persist bookmarks. No bank credentials, Aadhaar, PAN, KYC documents, OTP secrets or real financial data are ever collected or stored.

---

## 🗺️ Branch Discovery & Map-Data Transparency

Branches are shown on a **MapLibre GL** map (with **Leaflet kept as an automatic fallback**), including a Map/Satellite switcher, a "fit all branches" control, and red teardrop pins with IFSC, hours and a Google Maps directions link.

The branch dataset is deliberately **two clearly separated tiers**, and the UI labels them as such:

| Tier | Cities | Count | Evidence |
|------|--------|:-----:|----------|
| ✅ **Verified** | Hyderabad (7), Pune (8) | **15** | Each carries an **IFSC** and a link to the official bank locator used. |
| ⚠️ **Sample / unverified** | Mumbai (9), Delhi (7), Bengaluru (2) | **18** | Placeholder records, badged **"Sample data · not verified"**. |

Honesty rules baked into the map:

- **26 of 33** records have coordinates; the remaining **7 are `null` and are simply not plotted** — no location is invented.
- `geo_precision` distinguishes an exact **branch** pin, an approximate **locality/area** point, and a **demo** placeholder.
- **Empty combinations are never fabricated** — e.g. "No HDFC Bank branches on record for Bengaluru yet" with zero markers.
- **Map tiles require internet** (openfreemap for street, Esri for satellite). Offline, the map shows an honest notice, while the branch list, IFSC codes and directions links keep working.
- Granting geolocation uses **your real coordinates**; denying it invents nothing and tells you to pick a city manually.

---

## 🔌 API Overview

All endpoints return JSON. Success responses are wrapped as `{ "data": ... }`; errors use `{ "error": "message" }`.

### Catalogue (read-only — `GET` only)

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/health` | `{ "status": "ok" }` |
| `GET` | `/api/banks` | 5 banks |
| `GET` | `/api/loan-offers?loan_type=Home Loan` | 7 offers (optionally filtered) |
| `GET` | `/api/loan-offers/:id` | single offer · `404` if unknown |
| `GET` | `/api/loan-offers/:id/hidden-charges` | fine-print rows for an offer |
| `GET` | `/api/branches?city=&bank=` | 33 branches (optionally filtered) |
| `GET` | `/api/branches/:id` | single branch · `404` if unknown |

### Authentication

| Method | Path | Success | Failure |
|--------|------|---------|---------|
| `POST` | `/api/auth/register` | `201` + session cookie | `400` invalid · `409` duplicate · `429` rate-limited |
| `POST` | `/api/auth/login` | `200` + session cookie | `401` invalid credentials · `429` |
| `POST` | `/api/auth/logout` | `200`, clears cookie | — |
| `GET` | `/api/auth/me` | `200` current user | `401` when anonymous |

### Saved offers (auth required — otherwise `401`)

| Method | Path | Success | Failure |
|--------|------|---------|---------|
| `GET` | `/api/saved-offers` | `200` rows for the current user | `401` |
| `POST` | `/api/saved-offers` | `201` `{ "offer_id": ... }` | `400` bad body · `404` unknown offer · `409` duplicate |
| `DELETE` | `/api/saved-offers/:id` | `200` | `400` invalid id · `401` · `404` missing / another user's row |

**Hardening:** every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer`; malformed JSON returns `400` and oversized bodies return `413`; auth `POST`s are rate-limited (default 10/min/IP) with a `Retry-After` header; and static serving uses a path whitelist so source files and the database are never served.

---

## 🧪 Automated Testing

The repository ships **115 Playwright test cases across 15 spec files**, run against a **real `node server.js` instance** started by Playwright's `webServer` (not mocks). `npm test` also runs `pretest` first, which rebuilds and validates the database from the canonical dataset.

| Spec file | Focus |
|-----------|-------|
| `api.spec.js` | Read-only catalogue API contract & parity |
| `api-auth.spec.js` | API hardening, auth, rate limiting, cross-user isolation |
| `api-frontend.spec.js` | Frontend ↔ API integration |
| `auth-ui.spec.js` | Auth / session / guest flows in the browser |
| `backend-health.spec.js` | Health & boot behaviour |
| `db-init.spec.js` | Database lifecycle & non-destructive seeding |
| `regression.spec.js` | Matching & multi-combination regressions |
| `map.spec.js` / `map-pixels.spec.js` / `geo-branch.spec.js` | Map/geo behaviour, tile rendering, GPS granted & denied |
| `digilocker.spec.js` | DigiLocker simulation flow |
| `checklist-pdf.spec.js` | Real PDF download & extracted text |
| `saved-charges.spec.js` | Saved offers + hidden charges |
| `p2p-overflow.spec.js` | P2P dialog fit & scroll reachability across viewports |
| `accessibility.spec.js` | Labels, focus, keyboard and mobile viewports |

```bash
npm test              # pretest (db:init + db:validate) → full Playwright suite
npm run test:regression
npm run test:map
npm run test:p2p
```

> ℹ️ **115** is the case total from the last recorded full run (`playwright-report/report.json`: 115 expected, 0 failed, 0 flaky, 0 skipped). It exceeds the 104 literal `test(` declarations in the source because two specs are parameterised in loops — `accessibility.spec.js` expands one declaration across 6 views and `p2p-overflow.spec.js` expands two declarations across 4 viewports (3 declarations → 14 runtime cases, +11). Run `npm test` locally for the latest pass/fail output.

---

## 🚀 Installation & Local Setup

**Requirements:** Node.js **≥ 20** and npm.

```bash
git clone <your-repo-url>
cd <your-repo-name>

npm install        # install runtime + test dependencies
npm run db:init    # create & seed data/loanfinder.sqlite (non-destructive)
npm start          # serve the API + frontend on http://localhost:8080
```

Then open **<http://localhost:8080>**.

> 🌐 **Live Demo:** https://loanfinder-fullstack-web-prototype.onrender.com
>
> **Email:** `demo@loanfinder.in` **Password:** `demo1234`

> ⚠️ The frontend must be served by this server. Opening `index.html` directly over `file://` will not work, because the app loads its data from `/api`.

### Environment variables

| Variable | Default | Purpose |
|----------|:-------:|---------|
| `PORT` | `8080` | HTTP port (`0` picks a free port; used by tests). |
| `NODE_ENV` | unset | Set to `production` to enable the `Secure` cookie flag and HSTS (requires HTTPS). |
| `AUTH_RATE_LIMIT_MAX` | `10` | Max auth `POST`s per IP per minute. |

### Useful npm scripts

| Script | Does |
|--------|------|
| `npm start` | Run the API + frontend server. |
| `npm test` | `pretest` (db:init + db:validate), then the full Playwright suite. |
| `npm run db:init` | Create/migrate and re-seed reference data (never touches user accounts). |
| `npm run db:validate` | Read-only 22-check database validation. |
| `npm run db:extract` | Rebuild `data/loanfinder-data.json` from the frontend source. |
| `npm run test:regression` / `test:map` / `test:p2p` | Focused test subsets. |
| `npm run report:complete` / `report:status` | Generate PDF reports. |

---

## 📂 Project Structure

```text
loanfinder-fullstack-prototype/
├─ server.js                    # Express app: static frontend, security headers, routers
├─ src/
│  ├─ routes/
│  │  ├─ api.js                 # Read-only catalogue API (banks, offers, branches, charges)
│  │  ├─ auth.js                # register / login / logout / me
│  │  └─ saved-offers.js        # Auth-protected saved offers (GET, POST, DELETE)
│  ├─ auth/
│  │  ├─ passwords.js           # scrypt hash + timingSafeEqual verify
│  │  ├─ sessions.js            # opaque tokens (SHA-256 stored), cookie options
│  │  ├─ tokens.js              # random tokens + hashing
│  │  └─ auth-service.js        # register/login/logout/me + requireAuth
│  ├─ repositories/             # Read-only SQL: banks, loan-offers, branches, hidden-charges
│  ├─ db.js                     # SQLite handle (WAL, FK on)
│  ├─ migrate.js                # Ordered, idempotent migration runner
│  └─ rate-limit.js             # In-memory fixed-window limiter
├─ db/
│  ├─ migrations/               # 0001_baseline_schema.sql · 0002_auth_and_saved_offers.sql
│  └─ schema.sql
├─ scripts/
│  ├─ init-db.js                # Non-destructive initializer / seeder
│  ├─ validate-db.js            # 22-check database validation
│  ├─ extract-app-data.js       # Frontend → canonical JSON
│  └─ data-pipeline.js          # Normalise + verify source invariants
├─ data/
│  ├─ loanfinder-data.json      # Canonical dataset (source of truth)
│  └─ loanfinder.sqlite         # Runtime database (gitignored, reproducible)
├─ tests/                       # Playwright suite (15 spec files)
├─ vendor/                      # Vendored Lucide icons, map libs, pdf-lib
├─ index.html · styles.css · app.js · api.js   # Frontend
└─ package.json · playwright.config.js
```

---

## ⚠️ Prototype Limitations & Safety Disclaimer

This is a **demonstration prototype**, not a production lending product. It is honest about what it does *not* do:

- **Rates are catalogue data.** They are *advertised starting rates* collected from bank marketing, not live feeds and not personalised quotes.
- **No real integrations.** There is **no live DigiLocker, KYC/OTP, credit-bureau or core-banking integration**. The DigiLocker flow is a **simulation** (any six digits are accepted; the UI says no OTP is sent and no data leaves the browser).
- **P2P is a demonstration.** Funding, portfolio and chat run in local state only. **No real money moves** and nothing is transferred or invested.
- **No guarantees.** Eligibility output is indicative only and makes **no credit decision** — banks decide eligibility, not this app.
- **Not production-hardened.** The rate limiter is in-memory and per-process; there's no clustering, and the demo has no real deployment target. Some branch records are sample data (clearly badged), and the map basemap needs internet.
- **No audited statistics.** Any sums or counts are illustrative demo values, not audited financial figures.

**This project does not provide financial advice.** Always verify rates, fees and eligibility directly with the bank.

---

## 🗺️ Future Improvements

- **Verify or replace** the 18 sample branch records against official bank locators.
- **Add coordinates** for the 7 verified branches that currently can't be plotted.
- **Commit unit tests** for the EMI, ranking and P2P scoring algorithms (the current suite is integration-level).
- **Swap the in-memory rate limiter** for a shared store (e.g. Redis) before any horizontal scaling, and set `trust proxy` behind a load balancer.
- **Persist P2P data** server-side so portfolios and chat survive a reload.
- **Add screenshots / a short demo GIF** to this README once the UI is frozen.

---

<div align="center">

**Built with a framework-free frontend and a small, honest backend.**

<sub>Prototype for demonstration only · Not financial advice</sub>

</div>
