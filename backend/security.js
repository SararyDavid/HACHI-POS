/**
 * Hachi Tech POS - Enterprise Production Security Hardening Engine
 * Zero external dependencies: Built with native Node.js APIs.
 * Includes:
 * 1. Security Headers (CSP, HSTS, Framing, MIME Sniffing)
 * 2. Sliding Window Rate Limiter (Brute-force PIN attack & API flooding prevention)
 * 3. HMAC-SHA256 Payment Webhook Signature Verifier
 * 4. Production Error Sanitizer (Prevents SQL & stack trace leakage)
 */

const crypto = require('crypto');

// ==========================================================
// 1. Production Security Headers
// ==========================================================
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}

// ==========================================================
// 2. In-Memory Sliding Window Rate Limiter
// ==========================================================
class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 120, message = 'Too many requests. Please try again later.') {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;
    this.hits = new Map();

    // Clean up stale IP records every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [ip, records] of this.hits.entries()) {
        const valid = records.filter(time => now - time < this.windowMs);
        if (valid.length === 0) {
          this.hits.delete(ip);
        } else {
          this.hits.set(ip, valid);
        }
      }
    }, 5 * 60 * 1000);
  }

  middleware() {
    return (req, res, next) => {
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
      const now = Date.now();

      const userHits = this.hits.get(clientIp) || [];
      const windowStart = now - this.windowMs;
      const recentHits = userHits.filter(time => time > windowStart);

      if (recentHits.length >= this.maxRequests) {
        res.setHeader('Retry-After', Math.ceil(this.windowMs / 1000));
        return res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: this.message
        });
      }

      recentHits.push(now);
      this.hits.set(clientIp, recentHits);
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - recentHits.length));

      next();
    };
  }
}

// Global API rate limiter (180 requests/min per IP)
const apiRateLimiter = new RateLimiter(60 * 1000, 180, 'API rate limit exceeded. Please throttle requests.');

// Strict rate limiter for PIN authentication (10 attempts/min per IP to prevent brute forcing)
const authRateLimiter = new RateLimiter(60 * 1000, 10, 'Too many login attempts. Locked for 60 seconds.');

// ==========================================================
// 3. HMAC-SHA256 Webhook Signature Verification
// ==========================================================
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'hachi-khqr-webhook-secret-key-2026';

function verifyWebhookSignature(req, res, next) {
  // Allow bypassing if explicitly configured for development or testing
  if (process.env.NODE_ENV !== 'production' && !process.env.ENFORCE_WEBHOOK_SECRET) {
    return next();
  }

  const signature = req.headers['x-signature'] || req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing x-signature header on payment webhook.'
    });
  }

  const rawBody = JSON.stringify(req.body);
  const expectedSig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    console.warn('[Security Warning] Webhook HMAC signature verification FAILED from IP:', req.ip);
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Invalid payment webhook signature.'
    });
  }

  next();
}

// ==========================================================
// 4. Production Error Sanitizer
// ==========================================================
function errorHandler(err, req, res, next) {
  console.error('[Unhandled Server Error]', {
    message: err.message,
    path: req.originalUrl,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  const isProd = process.env.NODE_ENV === 'production';
  const statusCode = err.status || err.statusCode || 500;

  // Sanitize internal database errors (SQL syntax, connection strings)
  let safeMessage = err.message || 'An internal server error occurred.';
  if (isProd && (err.code?.startsWith('ER_') || err.message?.includes('SQL'))) {
    safeMessage = 'Database error occurred. Please contact the system administrator.';
  }

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    error: isProd ? undefined : err.stack
  });
}

module.exports = {
  securityHeaders,
  apiRateLimiter,
  authRateLimiter,
  verifyWebhookSignature,
  errorHandler
};
