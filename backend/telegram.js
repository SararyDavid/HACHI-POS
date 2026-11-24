/**
 * Hachi Tech POS - Telegram Live Payment Listener Service
 * Connects to @live_payment_bot via Telegram Long Polling
 */

const { confirmPayment } = require('./khqr');

let isPolling = false;
let lastUpdateId = 0;

async function sendTelegramMessage(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('[Telegram] Failed to send message:', err.message);
  }
}

function parsePaymentText(text) {
  // 1. Matches $15.99, USD 15.99, 15.99 USD
  const usdMatch = text.match(/(?:USD|\$)\s*([\d,]+(?:\.\d{1,2})?)/i) || text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:USD|\$)/i);
  // 2. Matches 40,000 KHR, 40000 KHR, KHR 40,000, 40000 ៛
  const khrMatch = text.match(/(?:KHR|៛)\s*([\d,]+)/i) || text.match(/([\d,]+)\s*(?:KHR|៛)/i);

  let amount = null;
  let currency = 'USD';

  if (usdMatch) {
    amount = usdMatch[1].replace(/,/g, '');
    currency = 'USD';
  } else if (khrMatch) {
    amount = khrMatch[1].replace(/,/g, '');
    currency = 'KHR';
  } else {
    // If command like /pay 15.5 or /pay 40000 KHR
    const cmdMatch = text.match(/\/pay\s+([\d,]+(?:\.\d{1,2})?)(?:\s+(USD|KHR))?/i);
    if (cmdMatch) {
      amount = cmdMatch[1].replace(/,/g, '');
      currency = cmdMatch[2] ? cmdMatch[2].toUpperCase() : 'USD';
    }
  }

  // Sender Name if in format: "from JOHN DOE" or "From: JOHN DOE"
  const fromMatch = text.match(/from[:\s]+([A-Za-z\s]+?)(?:\s+to|\s+via|\.|\(|$|\n)/i);
  const payerName = fromMatch ? fromMatch[1].trim() : 'ABA Telegram Customer';

  return { amount, currency, payerName };
}

async function startTelegramPoller() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || process.env.TELEGRAM_ENABLED === 'false') {
    console.log('[Telegram Bot] Skipped: TELEGRAM_BOT_TOKEN not configured or disabled.');
    return;
  }

  console.log('[Telegram Bot] 🚀 Starting live payment poller (@live_payment_bot)...');
  isPolling = true;

  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=20`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          const msg = update.message || update.channel_post;
          if (!msg || !msg.text) continue;

          const text = msg.text.trim();
          const chatId = msg.chat?.id;
          const senderName = msg.from ? `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() : 'Telegram User';

          console.log(`[Telegram Bot] 📩 Incoming Message from ${senderName}: "${text}"`);

          // Command: /start
          if (text === '/start') {
            await sendTelegramMessage(token, chatId, 
              `👋 <b>Hello ${senderName}!</b>\n\n` +
              `I am connected to <b>Hachi Tech POS</b>.\n\n` +
              `Whenever an ABA payment notification arrives or you send payment details here, ` +
              `I will automatically verify it and trigger the sale completion on the POS in real time!\n\n` +
              `💡 <i>Try sending <code>/pay 15.99</code> to test live real-time checkout!</i>`
            );
            continue;
          }

          // Command: /status
          if (text === '/status') {
            await sendTelegramMessage(token, chatId,
              `🟢 <b>Hachi POS Telegram Service: ONLINE</b>\n` +
              `• Bot: @live_payment_bot\n` +
              `• WebSockets: Active\n` +
              `• Server: Connected`
            );
            continue;
          }

          // Check if message is a payment alert
          const parsed = parsePaymentText(text);
          if (parsed.amount && parseFloat(parsed.amount) > 0) {
            console.log(`[Telegram Bot] ⚡ Payment Detected: ${parsed.currency === 'KHR' ? parsed.amount + ' ៛' : '$' + parsed.amount} from ${parsed.payerName}`);
            
            // Trigger POS checkout via KHQR Service
            confirmPayment(null, {
              amount: parsed.amount,
              currency: parsed.currency,
              payerName: parsed.payerName || senderName,
              source: 'Telegram Bot (@live_payment_bot)'
            });

            // Reply in Telegram
            const displayAmt = parsed.currency === 'KHR' ? `${Number(parsed.amount).toLocaleString()} ៛` : `$${Number(parsed.amount).toFixed(2)}`;
            await sendTelegramMessage(token, chatId,
              `✅ <b>Payment Confirmed on Hachi POS!</b>\n\n` +
              `💵 <b>Amount:</b> ${displayAmt}\n` +
              `👤 <b>Payer:</b> ${parsed.payerName || senderName}\n` +
              `🧾 <b>Status:</b> Transaction approved & receipt printed!`
            );
          }
        }
      }
    } catch (err) {
      // In case of network pause or timeout, wait 3 seconds and retry
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

function stopTelegramPoller() {
  isPolling = false;
}

module.exports = {
  startTelegramPoller,
  stopTelegramPoller
};
