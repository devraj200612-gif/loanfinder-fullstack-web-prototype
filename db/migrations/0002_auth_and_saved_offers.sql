-- LoanFinder accounts + saved offers (Phase 2E, migration 0002).
--
-- PROTOTYPE SCOPE. These tables exist only so the demo can persist "which
-- offers did I bookmark" per browser account across restarts. They deliberately
-- do NOT store (and there is no field for) bank credentials, Aadhaar, PAN, KYC
-- documents, credit-bureau logins, OTP secrets or any real financial account
-- information.
--
-- Applied by src/migrate.js. Never dropped by `npm run db:init`: the seed
-- script only rewrites the reference tables (banks, loan_offers, branches,
-- hidden_charges, meta).

-- --------------------------------------------------------------------------
-- users
-- --------------------------------------------------------------------------
-- email is stored normalized (trimmed + lower-cased) by the auth layer and is
-- UNIQUE, so "User@Example.com" and "user@example.com" are the same account.
-- password_hash is a PHC-style encoded scrypt hash (src/auth/passwords.js) -
-- never plaintext. It is never selected into an API response.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------------------------------
-- sessions
-- --------------------------------------------------------------------------
-- Server-side sessions for the HTTP-only session cookie. `id` stores the
-- SHA-256 of the opaque cookie token, so a leaked database dump does not hand
-- out live sessions. Sessions live in SQLite (not memory), so signing in
-- survives a server restart. Deleting a user cascades their sessions.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- --------------------------------------------------------------------------
-- saved_offers
-- --------------------------------------------------------------------------
-- One row per (user, saved loan offer). The client only ever sends an offer
-- id; the server resolves the real offer row from loan_offers. UNIQUE
-- (user_id, offer_id) makes duplicate saves impossible at the database level,
-- and every query is scoped by user_id so one account can never read or delete
-- another account's rows.
--
-- offer_id uses NO ACTION (not CASCADE): re-seeding the reference catalogue
-- must never silently wipe user data. Orphaned rows are purged explicitly by
-- scripts/init-db.js when - and only when - an offer id truly disappears.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_offers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id   TEXT NOT NULL REFERENCES loan_offers(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_offers_user  ON saved_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_offers_offer ON saved_offers(offer_id);
