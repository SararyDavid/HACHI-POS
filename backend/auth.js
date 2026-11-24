/**
 * Hachi Tech POS - Server-Side Cryptographic JWT Authentication & RBAC Engine
 * Zero external dependencies: Uses Node.js native crypto module (HMAC-SHA256).
 */

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'hachi-tech-pos-super-secure-production-secret-2026-key';

// Authorized Retail Staff Directory
const STAFF_USERS = [
  { id: 'usr_alex', name: 'Alex S.', role: 'cashier', pin: '1234' },
  { id: 'usr_david', name: 'David S.', role: 'manager', pin: '9999' },
  { id: 'usr_srey', name: 'Srey Mao', role: 'cashier', pin: '0000' }
];

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generate standard RFC 7519 HMAC-SHA256 JWT
 */
function signJwt(payload, expiresInSeconds = 86400) { // Default 24 hours
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode HMAC-SHA256 JWT
 */
function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  // Recreate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    // Verify expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Express Middleware: Enforce Valid JWT on Protected Endpoints
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in with your Cashier PIN.'
    });
  }

  const user = verifyJwt(token);
  if (!user) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired authentication token. Please sign in again.'
    });
  }

  req.user = user;
  next();
}

/**
 * Express Middleware: Optional Token (Falls back to default if absent)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    const user = verifyJwt(token);
    if (user) req.user = user;
  }
  next();
}

/**
 * Express Middleware: Role-Based Access Control (RBAC)
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: This operation requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`
      });
    }

    next();
  };
}

/**
 * Verify PIN and authenticate cashier
 */
function authenticateWithPin(pin) {
  const cleanPin = String(pin).trim();
  const matchedUser = STAFF_USERS.find(u => u.pin === cleanPin);

  if (!matchedUser) {
    return null;
  }

  const token = signJwt({
    id: matchedUser.id,
    name: matchedUser.name,
    role: matchedUser.role
  });

  return {
    token,
    user: {
      id: matchedUser.id,
      name: matchedUser.name,
      role: matchedUser.role
    }
  };
}

module.exports = {
  STAFF_USERS,
  signJwt,
  verifyJwt,
  authenticateToken,
  optionalAuth,
  requireRole,
  authenticateWithPin
};
