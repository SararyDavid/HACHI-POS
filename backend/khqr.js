/**
 * Hachi Tech POS - Bakong KHQR & ABA Bank Real-Time Payment Engine
 * Supports:
 * 1. David Sarary ABA Static QR (MY_ABA_STATIC_QR)
 * 2. EMVCo Dynamic KHQR with custom USD/KHR amounts & CRC16 checksum
 * 3. Real-Time payment notification via Server-Sent Events (SSE), WebSockets, and Webhooks
 * 4. NBC Bakong Open API polling (/v1/check_transaction_by_md5)
 */

const crypto = require('crypto');

// User's Official Static ABA Account QR Payload
const MY_ABA_STATIC_QR = "00020101021129450016abaakhppxxx@abaa01090090206940208ABA Bank40600006abaP2P01124EA70CC81BAE020900902069403090090206920404Dual5204599953031165802KH5912DAVID SARARY6010Phnom Penh6304C56A";

// Merchant Details
const MERCHANT_INFO = {
  name: "DAVID SARARY",
  city: "Phnom Penh",
  bank: "ABA Bank",
  accountNo: "009020694",
  bakongAccount: "abaakhppxxx@abaa",
  p2pTag: "0006abaP2P01124EA70CC81BAE020900902069403090090206920404Dual"
};

/**
 * Standard CCITT CRC-16 checksum (EMVCo specification polynomial 0x1021)
 */
function crc16(str) {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Helper to construct an EMVCo TLV (Tag-Length-Value) element
 */
function formatTag(tag, value) {
  const strVal = String(value);
  const len = String(strVal.length).padStart(2, '0');
  return tag + len + strVal;
}

/**
 * Generate EMVCo compliant Dynamic KHQR with precise amount, currency, and Bakong Tag 99 expiration
 */
function generateDynamicKhqr({ amount, currency = 'USD', billNo = '', validityMinutes = 15, timestamp = null }) {
  let payload = '';
  payload += formatTag('00', '01'); // Payload Format Indicator
  payload += formatTag('01', '12'); // 12 = Dynamic QR (Amount pre-filled), 11 = Static
  payload += formatTag('29', `0016${MERCHANT_INFO.bakongAccount}0109${MERCHANT_INFO.accountNo}0208${MERCHANT_INFO.bank}`);
  payload += formatTag('40', MERCHANT_INFO.p2pTag);
  payload += formatTag('52', '5999'); // Merchant Category Code
  
  // 840 = USD, 116 = KHR
  const currCode = currency === 'KHR' ? '116' : '840';
  payload += formatTag('53', currCode);
  
  // Format amount: USD requires 2 decimal places, KHR is integer
  const amtStr = currency === 'KHR' ? String(Math.round(amount)) : Number(amount).toFixed(2);
  payload += formatTag('54', amtStr);
  
  payload += formatTag('58', 'KH');
  payload += formatTag('59', MERCHANT_INFO.name);
  payload += formatTag('60', MERCHANT_INFO.city);
  
  if (billNo) {
    const sub62 = formatTag('01', billNo);
    payload += formatTag('62', sub62);
  }

  // Tag 99: Bakong Timestamp & Expiration Metadata (MANDATORY for ACLEDA Bank & NBC Bakong standard)
  const now = timestamp || Date.now();
  const expiresAt = now + (validityMinutes || 15) * 60 * 1000;
  const sub99 = formatTag('00', String(now)) + formatTag('01', String(expiresAt));
  payload += formatTag('99', sub99);
  
  // Append Tag 63 with length 04 for CRC calculation
  payload += '6304';
  const checksum = crc16(payload);
  const fullKhqr = payload + checksum;
  const md5 = crypto.createHash('md5').update(fullKhqr).digest('hex');
  
  return {
    khqr: fullKhqr,
    md5,
    amount: amtStr,
    currency,
    billNo,
    createdAt: now,
    expiresAt
  };
}

// ==========================================================
// In-Memory Active Payment Sessions & Real-Time Subscribers
// ==========================================================
const paymentSessions = new Map();
const sseClients = new Set();
const wsClients = new Set();

/**
 * Broadcast event to all connected browsers (via SSE & WebSockets)
 */
function broadcast(event, data) {
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  
  // Send to all SSE connections
  for (const client of sseClients) {
    try {
      client.write(`event: ${event}\ndata: ${payload}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }

  // Send to all WebSocket connections
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1) { // OPEN
        ws.send(payload);
      }
    } catch (e) {
      wsClients.delete(ws);
    }
  }
}

/**
 * Create a new live payment tracking session
 */
function createPaymentSession({ amount, currency = 'USD', billNo = '', mode = 'dynamic' }) {
  const sessionId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  
  let qrData;
  if (mode === 'static') {
    qrData = {
      khqr: MY_ABA_STATIC_QR,
      md5: crypto.createHash('md5').update(MY_ABA_STATIC_QR).digest('hex'),
      amount: currency === 'KHR' ? String(Math.round(amount)) : Number(amount).toFixed(2),
      currency,
      billNo
    };
  } else {
    qrData = generateDynamicKhqr({ amount, currency, billNo: billNo || sessionId });
  }

  const session = {
    id: sessionId,
    mode,
    ...qrData,
    status: 'PENDING', // PENDING | SUCCESS | EXPIRED | CANCELLED
    merchant: MERCHANT_INFO,
    staticFallbackQr: MY_ABA_STATIC_QR,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes validity
  };

  paymentSessions.set(sessionId, session);
  // Also index by MD5 for fast lookup
  paymentSessions.set(session.md5, session);

  // Auto clean up after expiration (16 minutes)
  setTimeout(() => {
    paymentSessions.delete(sessionId);
    paymentSessions.delete(session.md5);
  }, 16 * 60 * 1000);

  return session;
}

/**
 * Mark a payment as completed (from Webhook, Bakong Poll, or Simulation)
 */
function confirmPayment(identifier, paymentDetails = {}) {
  let session = paymentSessions.get(identifier);
  
  if (!session) {
    // If not found by ID or MD5, search by billNo or amount
    for (const [key, s] of paymentSessions.entries()) {
      if (s.billNo && paymentDetails.billNo && s.billNo === paymentDetails.billNo) {
        session = s;
        break;
      }
    }
  }

  if (!session) {
    // Fallback: Create ad-hoc approved session for incoming webhook
    session = {
      id: 'pay_adhoc_' + Date.now(),
      amount: paymentDetails.amount || '0.00',
      currency: paymentDetails.currency || 'USD',
      status: 'PENDING'
    };
  }

  session.status = 'SUCCESS';
  session.paidAt = Date.now();
  session.paymentDetails = {
    transactionId: paymentDetails.transactionId || 'TRX-' + Date.now(),
    payerName: paymentDetails.payerName || 'ABA Customer',
    payerAccount: paymentDetails.payerAccount || 'aba***@abaa',
    bank: paymentDetails.bank || 'ABA Bank (KHQR)',
    amount: paymentDetails.amount || session.amount,
    currency: paymentDetails.currency || session.currency,
    ...paymentDetails
  };

  // Broadcast real-time event to all connected POS frontends!
  broadcast('payment_success', {
    sessionId: session.id,
    md5: session.md5,
    amount: session.amount,
    currency: session.currency,
    status: 'SUCCESS',
    details: session.paymentDetails
  });

  return session;
}

// Cache to prevent burning through NBC Bakong 100 requests/day limit
const bakongRequestCache = new Map();

/**
 * Query NBC Bakong Open API for payment confirmation by MD5
 */
async function checkBakongTransaction(md5) {
  const token = process.env.BAKONG_DEVELOPER_TOKEN;
  const baseUrl = process.env.BAKONG_API_URL || 'https://api-bakong.nbc.gov.kh';
  
  if (!token) {
    return {
      success: false,
      configured: false,
      message: 'Bakong developer token not configured in .env (BAKONG_DEVELOPER_TOKEN)'
    };
  }

  // Quota conservation: If checked within last 5 seconds, return cached status
  const cached = bakongRequestCache.get(md5);
  if (cached && (Date.now() - cached.time < 5000)) {
    return cached.result;
  }

  try {
    const response = await fetch(`${baseUrl}/v1/check_transaction_by_md5`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ md5 })
    });

    const data = await response.json();
    
    // Bakong responseCode 0 represents success
    if (data.responseCode === 0 || data.errorCode === 0) {
      const confirmed = confirmPayment(md5, {
        transactionId: data.data?.hash || data.data?.externalRef,
        payerName: data.data?.fromAccountId,
        amount: data.data?.amount,
        currency: data.data?.currency
      });
      const res = { success: true, confirmed: true, data: confirmed };
      bakongRequestCache.set(md5, { time: Date.now(), result: res });
      return res;
    }

    const pendingResult = { success: true, confirmed: false, status: 'PENDING', bakong: data };
    bakongRequestCache.set(md5, { time: Date.now(), result: pendingResult });
    return pendingResult;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  MY_ABA_STATIC_QR,
  MERCHANT_INFO,
  crc16,
  generateDynamicKhqr,
  createPaymentSession,
  confirmPayment,
  checkBakongTransaction,
  paymentSessions,
  broadcast,
  sseClients,
  wsClients
};
