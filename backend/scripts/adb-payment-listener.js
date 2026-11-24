/**
 * Hachi Tech POS - Android USB Debugging (ADB) Payment Bridge
 * 
 * Automatically monitors connected Android phone via ADB for incoming ABA Mobile
 * payment notifications and pushes real-time payment confirmation directly to the POS!
 */

const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const POS_WEBHOOK_URL = 'http://localhost:5000/api/khqr/webhook';
const POLL_INTERVAL_MS = 1500;

// Known ADB binary candidates
const POSSIBLE_ADB_PATHS = [
  'adb', // If in system PATH
  path.join(__dirname, '..', 'tools', 'platform-tools', 'adb.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
  'C:\\platform-tools\\adb.exe'
];

let adbBinary = null;
for (const p of POSSIBLE_ADB_PATHS) {
  try {
    execSync(`"${p}" version`, { stdio: 'pipe' });
    adbBinary = p;
    break;
  } catch (e) {}
}

console.log('========================================================');
console.log('  HACHI POS - ANDROID USB REAL-TIME PAYMENT BRIDGE      ');
console.log('========================================================');

if (!adbBinary) {
  console.log('⚠️  ADB not found automatically in PATH or standard folders.');
  console.log('👉 Please download standalone platform-tools (adb.exe) into:');
  console.log(`   ${path.join(__dirname, '..', 'tools', 'platform-tools', 'adb.exe')}`);
  console.log('   Or run the setup script: npm run setup-adb');
  console.log('========================================================\n');
  process.exit(1);
}

console.log(`✓ Using ADB binary: ${adbBinary}`);

// Check connected devices
function getConnectedDevice() {
  try {
    const output = execSync(`"${adbBinary}" devices`, { encoding: 'utf8' });
    const lines = output.trim().split('\n').slice(1);
    const devices = lines
      .map(l => l.trim())
      .filter(l => l && !l.includes('offline') && !l.includes('unauthorized'));
    
    if (devices.length === 0) {
      if (lines.some(l => l.includes('unauthorized'))) {
        return { error: 'UNAUTHORIZED: Please tap "Allow USB Debugging" on your phone screen!' };
      }
      return { error: 'NO_DEVICE: Please connect your Android phone with USB Cable & enable USB Debugging!' };
    }
    
    const [deviceId] = devices[0].split(/\s+/);
    return { deviceId };
  } catch (err) {
    return { error: err.message };
  }
}

// Memory set to prevent duplicate triggers
const processedNotificationIds = new Set();

function checkNotifications() {
  try {
    // Dumpsys notification --noredact reveals notification titles, texts, and timestamps
    const cmd = `"${adbBinary}" shell dumpsys notification --noredact`;
    const dump = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

    // Look for NotificationRecords
    // Common Cambodia banking packages: com.ababank.mobile, com.aba.mobile, com.acleda.bank, etc.
    const records = dump.split(/NotificationRecord\(/g).slice(1);

    for (const record of records) {
      const isBankNotification = 
        record.includes('com.ababank.mobile') || 
        record.includes('com.aba.mobile') || 
        record.includes('com.acleda') || 
        record.includes('com.wingmoney') ||
        record.includes('ABA') || 
        record.includes('Bakong') ||
        record.includes('received') ||
        record.includes('Received');

      if (!isBankNotification) continue;

      // Extract unique identifier: postTime or key
      const postTimeMatch = record.match(/postTime=(\d+)/);
      const keyMatch = record.match(/key=([^ \n\r]+)/);
      const notifId = (keyMatch ? keyMatch[1] : '') + '_' + (postTimeMatch ? postTimeMatch[1] : '');

      if (!notifId || processedNotificationIds.has(notifId)) {
        continue;
      }

      // Check notification age (must be within last 3 minutes to avoid triggering on old notifications)
      if (postTimeMatch) {
        const notifTime = parseInt(postTimeMatch[1], 10);
        const now = Date.now();
        if (now - notifTime > 3 * 60 * 1000) {
          processedNotificationIds.add(notifId);
          continue;
        }
      }

      // Extract text content
      const textMatch = record.match(/android\.text=([^\n\r]+)/) || record.match(/tickerText=([^\n\r]+)/);
      const titleMatch = record.match(/android\.title=([^\n\r]+)/);

      const fullText = `${titleMatch ? titleMatch[1] : ''} ${textMatch ? textMatch[1] : ''}`;

      // Check if it's an incoming payment notification
      const isPaymentReceived = /received|credited|transferred|deposit|paid/i.test(fullText);
      if (!isPaymentReceived) continue;

      console.log('\n--------------------------------------------------------');
      console.log('⚡ [USB ADB DETECTED INCOMING BANK NOTIFICATION]');
      console.log(`   Raw Text: "${fullText.trim()}"`);

      // Extract amount & currency
      const usdMatch = fullText.match(/(?:USD|\$)\s*([\d,]+(?:\.\d{1,2})?)/i) || fullText.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:USD|\$)/i);
      const khrMatch = fullText.match(/(?:KHR|៛)\s*([\d,]+)/i) || fullText.match(/([\d,]+)\s*(?:KHR|៛)/i);

      let amount = null;
      let currency = 'USD';

      if (usdMatch) {
        amount = usdMatch[1].replace(/,/g, '');
        currency = 'USD';
      } else if (khrMatch) {
        amount = khrMatch[1].replace(/,/g, '');
        currency = 'KHR';
      }

      // Extract payer name
      const fromMatch = fullText.match(/from\s+([A-Za-z\s]+?)(?:\s+to|\s+via|\.|\(|$)/i);
      const payerName = fromMatch ? fromMatch[1].trim() : 'Mobile Banking Customer';

      console.log(`   💵 Parsed Amount: ${currency === 'KHR' ? amount + ' ៛' : '$' + amount}`);
      console.log(`   👤 Payer: ${payerName}`);

      // Forward to POS Webhook
      forwardToPos({
        amount,
        currency,
        payerName,
        text: fullText.trim(),
        notifId
      });

      processedNotificationIds.add(notifId);
    }
  } catch (err) {
    // If device disconnected during check
    if (err.message.includes('device') || err.message.includes('closed')) {
      console.log('⚠️ Phone disconnected. Waiting for USB reconnection...');
    }
  }
}

function forwardToPos(payload) {
  const data = JSON.stringify({
    ...payload,
    source: 'Android USB Debugging'
  });

  const req = http.request(POS_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('   🎉 POS Response: Payment broadcasted to Cashier screen!');
      console.log('--------------------------------------------------------\n');
    });
  });

  req.on('error', (e) => {
    console.error('   ❌ Could not forward to POS server:', e.message);
  });

  req.write(data);
  req.end();
}

// Start loop
console.log('📱 Scanning for connected Android phone via USB...');
let lastDeviceStatus = null;

setInterval(() => {
  const status = getConnectedDevice();
  if (status.error) {
    if (status.error !== lastDeviceStatus) {
      console.log(`⚠️  ${status.error}`);
      lastDeviceStatus = status.error;
    }
    return;
  }

  if (lastDeviceStatus !== status.deviceId) {
    console.log(`\n🎉 Android Phone Connected & Authorized! (Device ID: ${status.deviceId})`);
    console.log('⚡ Real-Time Payment Sniffer Active! Waiting for ABA / Bank notifications...\n');
    lastDeviceStatus = status.deviceId;
  }

  checkNotifications();
}, POLL_INTERVAL_MS);
