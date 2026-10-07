'use strict';

const { getDb } = require('../db');
const { hashPassword, verifyPassword } = require('./passwords');
const { createSession, destroySession, getUserFromSession, clearExpiredSessions, COOKIE_NAME, sessionCookieOptions } = require('./sessions');

function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validatePassword(pw) {
  if (typeof pw !== 'string') return 'Password required';
  if (pw.length < 8) return 'Password must be at least 8 characters';
  return null;
}

async function registerUser(email, password) {
  const norm = normalizeEmail(email);
  if (!isValidEmail(norm)) throw new Error('Invalid email');
  const err = validatePassword(password);
  if (err) throw new Error(err);
  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(norm);
  if (exists) throw new Error('Email already registered');
  const hash = await hashPassword(password);
  const info = db.prepare(`
    INSERT INTO users (email, password_hash, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
  `).run(norm, hash);
  return { id: info.lastInsertRowid, email: norm };
}

async function loginUser(email, password) {
  const norm = normalizeEmail(email);
  const db = getDb();
  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(norm);
  if (!user) throw new Error('Invalid credentials');
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw new Error('Invalid credentials');
  const sess = createSession(user.id);
  return { user: { id: user.id, email: user.email }, token: sess.token, expiresAt: sess.expiresAt };
}

function logoutUser(req) {
  return destroySession(req);
}

function me(req) {
  return getUserFromSession(req);
}

function requireAuth(req, res, next) {
  clearExpiredSessions();
  const user = getUserFromSession(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  next();
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  me,
  requireAuth,
  validatePassword,
  isValidEmail,
  normalizeEmail,
  COOKIE_NAME,
  sessionCookieOptions
};
