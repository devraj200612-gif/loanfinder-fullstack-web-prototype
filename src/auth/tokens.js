'use strict';

// Simple random token generation (for opaque session tokens).
const crypto = require('crypto');

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256Base64url(bufOrStr) {
  const input = Buffer.isBuffer(bufOrStr) ? bufOrStr : Buffer.from(bufOrStr);
  return crypto.createHash('sha256').update(input).digest('base64url');
}

module.exports = { randomToken, sha256Base64url };
