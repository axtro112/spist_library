/**
 * authToken.js
 * Lightweight signed-cookie auth token using Node's built-in crypto.
 * No extra npm package required.
 *
 * Token format:  base64url(payload_json).hmac_sha256_base64url
 *
 * The HMAC key is the SESSION_SECRET so a server restart or secret
 * rotation automatically invalidates all old tokens.
 */

'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'spist_student_auth';
const MAX_AGE_MS  = 8 * 60 * 60 * 1000; // 8 h — matches session cookie maxAge

// ─── helpers ──────────────────────────────────────────────────────────────────

function _secret() {
  return process.env.SESSION_SECRET || 'spist-library-secret-key-change-in-production';
}

function _hmac(encoded) {
  return crypto
    .createHmac('sha256', _secret())
    .update(encoded)
    .digest('base64url');
}

// ─── core token API ───────────────────────────────────────────────────────────

/**
 * Create a signed token string.
 * @param {object} payload
 * @returns {string}
 */
function createToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = _hmac(encoded);
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a token. Returns the payload object, or null if invalid.
 * @param {string|undefined} token
 * @returns {object|null}
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;

  const encoded  = token.slice(0, dot);
  const sig      = token.slice(dot + 1);
  const expected = _hmac(encoded);

  // Constant-time comparison — prevents timing side-channel attacks
  if (sig.length !== expected.length) return null;
  let match = false;
  try {
    match = crypto.timingSafeEqual(
      Buffer.from(sig,      'base64url'),
      Buffer.from(expected, 'base64url')
    );
  } catch {
    return null;
  }
  if (!match) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── cookie utilities ─────────────────────────────────────────────────────────

/**
 * Parse a single named cookie from the raw Cookie header.
 * Works without cookie-parser.
 */
function _readRawCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k.trim() === name) return decodeURIComponent(v.join('=').trim()) || null;
  }
  return null;
}

function _cookieOptions() {
  return {
    httpOnly: true,
    maxAge:   MAX_AGE_MS,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure:   process.env.NODE_ENV === 'production',
  };
}

/**
 * Set the student auth backup cookie on the response.
 * Call this immediately after a successful student login.
 *
 * @param {import('express').Response} res
 * @param {{ id: any, studentId?: any, student_id?: any }} student
 */
function setStudentAuthCookie(res, student) {
  const token = createToken({
    sub:  String(student.id),
    sid:  String(student.studentId || student.student_id || student.id),
    role: 'student',
    exp:  Date.now() + MAX_AGE_MS,
  });
  res.cookie(COOKIE_NAME, token, _cookieOptions());
}

/**
 * Clear the student auth cookie (e.g., on logout or admin login).
 * @param {import('express').Response} res
 */
function clearStudentAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure:   process.env.NODE_ENV === 'production',
  });
}

/**
 * Read and verify the student auth backup cookie from the request.
 * Returns the decoded payload { sub, sid, role } or null.
 *
 * @param {import('express').Request} req
 * @returns {{ sub: string, sid: string, role: 'student' }|null}
 */
function readStudentAuthCookie(req) {
  const raw     = _readRawCookie(req, COOKIE_NAME);
  const payload = verifyToken(raw);
  if (!payload || payload.role !== 'student') return null;
  return payload;
}

module.exports = {
  createToken,
  verifyToken,
  setStudentAuthCookie,
  clearStudentAuthCookie,
  readStudentAuthCookie,
};
