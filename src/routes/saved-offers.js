'use strict';

const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../auth/auth-service');

const router = express.Router();

router.use(express.json());

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT so.id, so.offer_id, so.created_at
    FROM saved_offers so
    WHERE so.user_id = ?
    ORDER BY so.created_at DESC, so.id DESC
  `).all(req.user.id);
  res.json({ data: rows });
});

router.post('/', requireAuth, (req, res) => {
  const db = getDb();
  const offerId = req.body && req.body.offer_id;
  if (!offerId || typeof offerId !== 'string') {
    return res.status(400).json({ error: 'offer_id required' });
  }
  const offer = db.prepare('SELECT id FROM loan_offers WHERE id = ?').get(offerId);
  if (!offer) {
    return res.status(404).json({ error: 'Loan offer not found' });
  }
  try {
    const info = db.prepare(`
      INSERT INTO saved_offers (user_id, offer_id, created_at)
      VALUES (?, ?, datetime('now'))
    `).run(req.user.id, offerId);
    res.status(201).json({ data: { id: info.lastInsertRowid, offer_id: offerId } });
  } catch (e) {
    if (e && (e.code === 'SQLITE_CONSTRAINT' || e.code === 'SQLITE_CONSTRAINT_UNIQUE')) {
      if (e.message && e.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Offer already saved' });
      }
      return res.status(409).json({ error: 'Offer already saved' });
    }
    throw e;
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid saved offer id' });
  }
  const info = db.prepare(`
    DELETE FROM saved_offers WHERE id = ? AND user_id = ?
  `).run(id, req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Saved offer not found' });
  }
  res.json({ data: { success: true } });
});

module.exports = router;
