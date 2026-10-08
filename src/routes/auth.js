'use strict';

const express = require('express');
const { registerUser, loginUser, logoutUser, me, requireAuth, COOKIE_NAME, sessionCookieOptions } = require('../auth/auth-service');

const router = express.Router();

function safeUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email };
}

router.post('/register', async (req, res, next) => {
  try {
    const email = req.body && req.body.email;
    const password = req.body && req.body.password;
    const user = await registerUser(email, password);
    // Auto-login on register for simplicity in prototype
    const sess = await loginUser(email, password);
    res.cookie(COOKIE_NAME, sess.token, sessionCookieOptions());
    res.status(201).json({ data: { user: { id: user.id, email: user.email } } });
  } catch (e) {
    if (e && e.message === 'Email already registered') return res.status(409).json({ error: 'Email already registered' });
    if (e && (e.message === 'Invalid email' || e.message.startsWith('Password'))) return res.status(400).json({ error: e.message });
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = req.body && req.body.email;
    const password = req.body && req.body.password;
    const sess = await loginUser(email, password);
    res.cookie(COOKIE_NAME, sess.token, sessionCookieOptions());
    res.json({ data: { user: sess.user } });
  } catch (e) {
    // Only genuine credential failures are 401. Anything else (for example the
    // database being unavailable) must surface as a server error instead of
    // masquerading as a wrong password.
    if (e && e.message === 'Invalid credentials') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    next(e);
  }
});

router.post('/logout', (req, res) => {
  logoutUser(req);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ data: { success: true } });
});

router.get('/me', (req, res) => {
  const user = me(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  res.json({ data: { user: safeUser(user) } });
});

module.exports = router;
