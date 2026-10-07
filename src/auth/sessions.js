'use strict';

const crypto = require('crypto');
const { getDb } = require('../db');
const { randomToken, sha256Base64url } = require('./tokens');

const COOKIE_NAME = 'lf_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function createSession(userId) {
  const token = randomToken(32);
  const tokenHash = sha256Base64url(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS).toISOString();
  const db = getDb();
  db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, userId, now.toISOString(), expiresAt);
  return { token, expiresAt };
}

function getUserFromSession(req) {
  const db = getDb();
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const tokenHash = sha256Base64url(token);
  const nowIso = new Date().toISOString();
  const row = db.prepare(`
    SELECT u.id, u.email, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(tokenHash, nowIso);
  if (!row) return null;
  return { id: row.id, email: row.email };
}

function destroySession(req) {
  const db = getDb();
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const tokenHash = sha256Base64url(token);
  const info = db.prepare('DELETE FROM sessions WHERE id = ?').run(tokenHash);
  return info.changes > 0;
}

function clearExpiredSessions() {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  header.split(';').forEach(part => {
    const [k, ...rest] = part.trim().split('=');
    if (!k) return;
    out[k] = rest.join('=');
  });
  return out;
}

function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd, // dev over http; tests run http
    path: '/',
    maxAge: SESSION_MAX_AGE_MS
  };
}

module.exports = { COOKIE_NAME, createSession, getUserFromSession, destroySession, clearExpiredSessions, sessionCookieOptions, parseCookies };
