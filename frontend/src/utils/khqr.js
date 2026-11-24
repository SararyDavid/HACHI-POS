/**
 * Hachi Tech POS - Frontend KHQR & ABA Real-Time Engine
 */

export const MY_ABA_STATIC_QR = "00020101021129450016abaakhppxxx@abaa01090090206940208ABA Bank40600006abaP2P01124EA70CC81BAE020900902069403090090206920404Dual5204599953031165802KH5912DAVID SARARY6010Phnom Penh6304C56A";

export const MERCHANT_INFO = {
  name: "DAVID SARARY",
  city: "Phnom Penh",
  bank: "ABA Bank",
  accountNo: "009020694",
  bakongAccount: "abaakhppxxx@abaa"
};

/**
 * Standard CCITT CRC-16 checksum (EMVCo specification polynomial 0x1021)
 */
export function crc16(str) {
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

function formatTag(tag, value) {
  const strVal = String(value);
  const len = String(strVal.length).padStart(2, '0');
  return tag + len + strVal;
}

/**
 * Generates EMVCo Dynamic KHQR string with pre-filled amount, currency, and Bakong Tag 99 expiration
 * (Required by ACLEDA Bank and NBC Bakong standard)
 */
export function generateDynamicKhqr({ 
  amount, 
  currency = 'USD', 
  billNo = '', 
  validityMinutes = 15,
  timestamp = null 
}) {
  let payload = '';
  payload += formatTag('00', '01');
  payload += formatTag('01', '12'); // 12 = Dynamic
  payload += formatTag('29', `0016${MERCHANT_INFO.bakongAccount}0109${MERCHANT_INFO.accountNo}0208${MERCHANT_INFO.bank}`);
  payload += formatTag('40', '0006abaP2P01124EA70CC81BAE020900902069403090090206920404Dual');
  payload += formatTag('52', '5999');
  
  const currCode = currency === 'KHR' ? '116' : '840';
  payload += formatTag('53', currCode);
  
  const amtStr = currency === 'KHR' ? String(Math.round(amount)) : Number(amount).toFixed(2);
  payload += formatTag('54', amtStr);
  
  payload += formatTag('58', 'KH');
  payload += formatTag('59', MERCHANT_INFO.name);
  payload += formatTag('60', MERCHANT_INFO.city);
  
  if (billNo) {
    const sub62 = formatTag('01', billNo);
    payload += formatTag('62', sub62);
  }

  // Tag 99: Bakong Timestamp & Expiration Metadata (MANDATORY for ACLEDA Bank)
  const now = timestamp || Date.now();
  const expiresAt = now + (validityMinutes || 15) * 60 * 1000;
  const sub99 = formatTag('00', String(now)) + formatTag('01', String(expiresAt));
  payload += formatTag('99', sub99);
  
  payload += '6304';
  const checksum = crc16(payload);
  return payload + checksum;
}

/**
 * Setup Real-time Payment Event Listener (Dual SSE + WebSocket)
 */
export function subscribeToPaymentEvents(onPaymentSuccess) {
  let eventSource = null;
  let socket = null;
  let isClosed = false;

  // 1. Try Server-Sent Events (SSE)
  try {
    eventSource = new EventSource('/api/khqr/stream');
    eventSource.addEventListener('payment_success', (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (onPaymentSuccess) onPaymentSuccess(parsed.data || parsed);
      } catch (err) {
        console.error('Error parsing payment event:', err);
      }
    });
  } catch (err) {
    console.warn('SSE subscription failed, falling back to WebSocket:', err);
  }

  // 2. Dual WebSocket connection
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/payments`;
    socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'payment_success' && onPaymentSuccess) {
          onPaymentSuccess(parsed.data || parsed);
        }
      } catch (err) {}
    };

    socket.onerror = () => {};
  } catch (err) {}

  return () => {
    isClosed = true;
    if (eventSource) eventSource.close();
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  };
}
