'use strict';

// Password hashing utilities for Phase 2E prototype auth.
// - Uses Node.js built-in crypto.scrypt (modern, available in Node v24)
// - Returns PHC-style: scrypt$N$r$p$saltHex$hashHex
// - Prototype password requirements: at least 8 chars

const crypto = require('crypto');

const DEFAULT_SALT_LEN = 16;
const DEFAULT_KEY_LEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return Promise.reject(new Error('Password required'));
  }
  if (password.length < 8) {
    return Promise.reject(new Error('Password must be at least 8 characters'));
  }
  const salt = crypto.randomBytes(DEFAULT_SALT_LEN);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, DEFAULT_KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, derived) => {
      if (err) return reject(err);
      resolve(`scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${derived.toString('hex')}`);
    });
  });
}

function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return Promise.resolve(false);
  try {
    const parts = encoded.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return Promise.resolve(false);
    const Np = parseInt(parts[1], 10);
    const rp = parseInt(parts[2], 10);
    const pp = parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, expected.length, { N: Np, r: rp, p: pp }, (err, derived) => {
        if (err) return reject(err);
        try {
          resolve(crypto.timingSafeEqual(derived, expected));
        } catch (e) {
          resolve(false);
        }
      });
    });
  } catch (e) {
    return Promise.resolve(false);
  }
}

module.exports = { hashPassword, verifyPassword };
