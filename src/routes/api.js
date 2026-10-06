'use strict';

// Read-only REST data API (Phase 2C).
//
// All application data endpoints live under /api and read from the Phase 2B
// SQLite database. Response conventions:
//
//   collection  -> 200 { "data": [ ... ] }
//   single      -> 200 { "data": { ... } }
//   not found   -> 404 { "error": "<message>" }
//   db missing  -> 500 { "error": "Database unavailable" }
//
// Every query is a parameterized prepared statement; user input is never
// concatenated into SQL. The layer is intentionally read-only: only GET
// handlers are registered, so POST/PUT/PATCH/DELETE fall through to the 404
// handler. No auth, no sessions, no caching.

const express = require('express');

const { getDb } = require('../db');
const banksRepo = require('../repositories/banks');
const offersRepo = require('../repositories/loan-offers');
const branchesRepo = require('../repositories/branches');
const chargesRepo = require('../repositories/hidden-charges');

const router = express.Router();

function withDb(handler) {
  return (req, res, next) => {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database unavailable' });
    }
    try {
      handler(req, res, db);
    } catch (e) {
      next(e);
    }
  };
}

// ---------------------------------------------------------------------------
// Banks
// ---------------------------------------------------------------------------
router.get(
  '/banks',
  withDb((req, res, db) => {
    res.json({ data: banksRepo.listAll(db) });
  })
);

// ---------------------------------------------------------------------------
// Loan offers (optional ?loan_type=home|personal filter)
// ---------------------------------------------------------------------------
router.get(
  '/loan-offers',
  withDb((req, res, db) => {
    const loanType = typeof req.query.loan_type === 'string' ? req.query.loan_type : '';
    res.json({ data: offersRepo.list(db, loanType) });
  })
);

router.get(
  '/loan-offers/:id/hidden-charges',
  withDb((req, res, db) => {
    const offer = offersRepo.findById(db, req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Loan offer not found' });
    }
    res.json({ data: chargesRepo.listByOffer(db, offer.id) });
  })
);

router.get(
  '/loan-offers/:id',
  withDb((req, res, db) => {
    const offer = offersRepo.findById(db, req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Loan offer not found' });
    }
    res.json({ data: offer });
  })
);

// ---------------------------------------------------------------------------
// Branches (optional ?city=Mumbai etc. filter)
// ---------------------------------------------------------------------------
router.get(
  '/branches/:id',
  withDb((req, res, db) => {
    const branch = branchesRepo.findById(db, req.params.id);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    res.json({ data: branch });
  })
);

router.get(
  '/branches',
  withDb((req, res, db) => {
    const city = typeof req.query.city === 'string' ? req.query.city : '';
    res.json({ data: branchesRepo.list(db, city) });
  })
);

module.exports = router;