const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { db, initDatabase } = require('./db');
const { buildEscPosReceipt, buildZReportEscPos } = require('./escpos');
const {
  MY_ABA_STATIC_QR,
  MERCHANT_INFO,
  createPaymentSession,
  confirmPayment,
  checkBakongTransaction,
  paymentSessions,
  broadcast,
  sseClients,
  wsClients
} = require('./khqr');
const { startTelegramPoller } = require('./telegram');
const {
  authenticateToken,
  optionalAuth,
  requireRole,
  authenticateWithPin,
  STAFF_USERS
} = require('./auth');
const {
  securityHeaders,
  apiRateLimiter,
  authRateLimiter,
  verifyWebhookSignature,
  errorHandler
} = require('./security');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Standard Middleware
app.use(securityHeaders);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRateLimiter.middleware());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ==========================================================
// 0. Staff Authentication & Session Endpoints
// ==========================================================
// POST /api/auth/login - Cashier / Manager PIN Sign-in
app.post('/api/auth/login', authRateLimiter.middleware(), (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, message: 'Cashier PIN is required.' });
    }

    const authResult = authenticateWithPin(pin);
    if (!authResult) {
      return res.status(401).json({ success: false, message: 'Invalid Cashier PIN. Access denied.' });
    }

    res.json({
      success: true,
      message: `Welcome, ${authResult.user.name} (${authResult.user.role})!`,
      data: authResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/me - Verify active JWT session token
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// GET /api/auth/staff - List available staff accounts for switchers
app.get('/api/auth/staff', (req, res) => {
  res.json({
    success: true,
    data: STAFF_USERS.map(u => ({ id: u.id, name: u.name, role: u.role }))
  });
});

// ==========================================================
// 1. System Health & Database Diagnostics Route
// ==========================================================
app.get('/api/health', (req, res) => {
  const status = db.getStatus();
  res.json({
    status: 'ok',
    system: 'Hachi Tech POS & Inventory API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: status,
    store: {
      name: process.env.STORE_NAME || 'HACHI TECH & IT SOLUTIONS',
      address: process.env.STORE_ADDRESS || 'Building 42, St. 2004, Phnom Penh',
      phone: process.env.STORE_PHONE || '+855 23 888 999',
      taxId: process.env.STORE_TAX_ID || 'VAT-KHM-2026-90412'
    }
  });
});

// ==========================================================
// 2. Products API Routes
// ==========================================================

// GET /api/products - Fetch products with search (?q=) and category filter (?category=)
app.get('/api/products', async (req, res) => {
  try {
    const { q = '', category = '' } = req.query;
    const products = await db.getProducts({ search: q, category });
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve products', error: error.message });
  }
});

// GET /api/products/barcode/:code - Instant lookup by retail box barcode
app.get('/api/products/barcode/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Barcode is required' });
    }

    const product = await db.getProductByBarcode(code.trim());
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `No product found matching barcode '${code}'`
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error looking up barcode:', error);
    res.status(500).json({ success: false, message: 'Barcode lookup failed', error: error.message });
  }
});

// GET /api/products/:id - Single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/products - Add a new product (handles USB barcode scans directly)
app.post('/api/products', optionalAuth, async (req, res) => {
  try {
    const { barcode, name, category, brand, cost_price, selling_price, stock_qty, low_stock_threshold } = req.body;

    if (!barcode || !name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Barcode, Name, and Category are required fields.'
      });
    }

    // Check duplicate barcode
    const existing = await db.getProductByBarcode(barcode.trim());
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A product with barcode "${barcode}" already exists: "${existing.name}"`
      });
    }

    const created = await db.createProduct({
      barcode,
      name,
      category,
      brand,
      cost_price,
      selling_price,
      stock_qty,
      low_stock_threshold,
      warranty_period: req.body.warranty_period,
      requires_serial: req.body.requires_serial,
      image: req.body.image
    });

    res.status(201).json({
      success: true,
      message: `Product "${created.name}" created successfully.`,
      data: created
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Failed to create product', error: error.message });
  }
});

// PUT /api/products/:id - Update product details or restock quantity
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.getProductById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const updated = await db.updateProduct(id, req.body);
    res.json({
      success: true,
      message: `Product "${updated.name}" updated successfully.`,
      data: updated
    });
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to update product', error: error.message });
  }
});

// DELETE /api/products/:id - Delete a product (Manager authorization required)
app.delete('/api/products/:id', authenticateToken, requireRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteProduct(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Product not found or already deleted' });
    }

    res.json({
      success: true,
      message: `Product ID #${id} deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product', error: error.message });
  }
});

// ==========================================================
// 3. Checkout ACID Transaction Route
// ==========================================================
// POST /api/checkout - Crucial ACID Transaction
app.post('/api/checkout', optionalAuth, async (req, res) => {
  try {
    const {
      cart,
      payment_method = 'cash',
      amount_received,
      discount = 0,
      tax = 0,
      cashier_name = req.user?.name || process.env.DEFAULT_CASHIER || 'Alex S.'
    } = req.body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart cannot be empty for checkout.'
      });
    }

    // Process ACID transaction with Dual Currency and S/N support
    const receipt = await db.processCheckout({
      cart,
      payment_method,
      amount_received,
      amount_received_khr: req.body.amount_received_khr,
      exchange_rate: req.body.exchange_rate || 4100,
      discount,
      tax,
      cashier_name
    });

    console.log(`[Checkout] Transaction committed: ${receipt.invoice_no} ($${receipt.total_amount.toFixed(2)} / ${receipt.total_khr.toLocaleString()} KHR) via ${payment_method}`);

    // Generate ESC/POS hardware command payload ready for thermal printing
    const escposData = buildEscPosReceipt(receipt);

    res.status(201).json({
      success: true,
      message: 'Transaction successfully processed and stock updated.',
      data: {
        receipt,
        escpos: {
          base64: escposData.base64,
          hex: escposData.hex,
          byteLength: escposData.byteLength
        }
      }
    });
  } catch (error) {
    console.error('[Checkout Error]', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Checkout failed due to transaction conflict or insufficient stock.'
    });
  }
});

// ==========================================================
// 4. Shift Management & End-of-Day Z-Report Endpoints
// ==========================================================
// GET /api/shifts/current - Get active open shift
app.get('/api/shifts/current', async (req, res) => {
  try {
    const shift = await db.getCurrentShift();
    res.json({ success: true, data: shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/shifts/start - Open a new shift with float
app.post('/api/shifts/start', async (req, res) => {
  try {
    const { cashier_name, opening_float, notes } = req.body;
    const shift = await db.startShift({ cashier_name, opening_float, notes });
    res.status(201).json({ success: true, message: `Shift ${shift.shift_no} opened successfully`, data: shift });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/shifts/close - Close shift, calculate difference & build Z-Report
app.post('/api/shifts/close', async (req, res) => {
  try {
    const { shift_id, counted_cash, notes } = req.body;
    if (!shift_id) return res.status(400).json({ success: false, message: 'Shift ID is required' });
    const shift = await db.closeShift({ shift_id, counted_cash, notes });
    const zReportEscpos = buildZReportEscPos(shift);
    res.json({
      success: true,
      message: `Shift ${shift.shift_no} closed successfully. Z-Report generated.`,
      data: {
        shift,
        escpos: zReportEscpos
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/shifts/history - Shift records
app.get('/api/shifts/history', async (req, res) => {
  try {
    const shifts = await db.getShiftHistory();
    res.json({ success: true, data: shifts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/print/z-report - ESC/POS print for Z-Report
app.post('/api/print/z-report', async (req, res) => {
  try {
    const { shift } = req.body;
    if (!shift) return res.status(400).json({ success: false, message: 'Shift data required' });
    const zReport = buildZReportEscPos(shift);
    res.json({ success: true, escpos: zReport });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================================
// 4. Sales History & Analytics Routes
// ==========================================================
// GET /api/sales - Transaction history & daily summary metrics
app.get('/api/sales', async (req, res) => {
  try {
    const salesData = await db.getSalesHistory();
    res.json({
      success: true,
      data: salesData
    });
  } catch (error) {
    console.error('Error fetching sales history:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve sales records', error: error.message });
  }
});

// POST /api/sales/:invoice_no/refund - Transactional RMA refund & stock restoration
app.post('/api/sales/:invoice_no/refund', authenticateToken, requireRole(['manager', 'cashier']), async (req, res) => {
  try {
    const { invoice_no } = req.params;
    const { reason = 'Customer Return / RMA' } = req.body;

    const refundResult = await db.processRefund(invoice_no, {
      reason,
      cashier_name: req.user.name
    });

    console.log(`[RMA Refund] Invoice ${invoice_no} refunded by ${req.user.name}. Restored stock.`);

    res.json({
      success: true,
      message: `Invoice #${invoice_no} successfully refunded. Restored ${refundResult.restored_items_count} item(s) to stock.`,
      data: refundResult
    });
  } catch (error) {
    console.error('Error processing refund:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================================
// 5. Hardware Receipt Printing API (ESC/POS)
// ==========================================================
// POST /api/print - ESC/POS thermal command generator & hardware transmitter
app.post('/api/print', async (req, res) => {
  try {
    const { sale, printerIp, printerPort = 9100 } = req.body;

    if (!sale || !sale.invoice_no) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sale object provided for ESC/POS printing.'
      });
    }

    const escposResult = buildEscPosReceipt(sale);

    // If a physical ESC/POS IP printer is configured and requested:
    let hardwareStatus = 'Generated ESC/POS buffer (Ready for USB/Raw Network transmission)';

    if (printerIp) {
      const net = require('net');
      const client = new net.Socket();
      
      const printPromise = new Promise((resolve, reject) => {
        client.setTimeout(3000);
        client.connect(printerPort, printerIp, () => {
          client.write(escposResult.rawBuffer, () => {
            client.end();
            resolve(true);
          });
        });
        client.on('error', (err) => {
          client.destroy();
          reject(err);
        });
        client.on('timeout', () => {
          client.destroy();
          reject(new Error(`Connection to printer at ${printerIp}:${printerPort} timed out.`));
        });
      });

      try {
        await printPromise;
        hardwareStatus = `Successfully sent ${escposResult.byteLength} bytes to thermal printer at ${printerIp}:${printerPort}`;
      } catch (printErr) {
        hardwareStatus = `ESC/POS generated, but network printer error: ${printErr.message}`;
      }
    }

    res.json({
      success: true,
      message: 'ESC/POS commands generated successfully',
      hardwareStatus,
      escpos: {
        base64: escposResult.base64,
        hex: escposResult.hex,
        byteLength: escposResult.byteLength
      }
    });
  } catch (error) {
    console.error('Print generation error:', error);
    res.status(500).json({ success: false, message: 'Printer command generation failed', error: error.message });
  }
});

// ==========================================================
// 6. Bakong KHQR & ABA Real-Time Payment Routes
// ==========================================================

// GET /api/khqr/static - Get official static David Sarary ABA QR
app.get('/api/khqr/static', (req, res) => {
  res.json({
    success: true,
    qr: MY_ABA_STATIC_QR,
    merchant: MERCHANT_INFO
  });
});

// POST /api/khqr/create - Create a real-time payment session (dynamic or static)
app.post('/api/khqr/create', (req, res) => {
  try {
    const { amount, currency = 'USD', billNo = '', mode = 'dynamic' } = req.body;
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const session = createPaymentSession({ amount, currency, billNo, mode });
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/khqr/stream - Server-Sent Events (SSE) for real-time payment push to POS
app.get('/api/khqr/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// POST /api/khqr/check/:md5 - Check transaction status via NBC Bakong Open API
app.post('/api/khqr/check/:md5', async (req, res) => {
  try {
    const { md5 } = req.params;
    const session = paymentSessions.get(md5);
    
    if (session && session.status === 'SUCCESS') {
      return res.json({ success: true, status: 'SUCCESS', data: session });
    }

    // Call Bakong Open API if token is configured
    const checkResult = await checkBakongTransaction(md5);
    res.json(checkResult);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/khqr/webhook - Webhook listener with HMAC-SHA256 signature verification
app.post('/api/khqr/webhook', verifyWebhookSignature, (req, res) => {
  try {
    let { tran_id, billNo, amount, currency, payerName, hash, text, message, content, title } = req.body || {};
    
    // Auto-parse raw SMS or Push Notification text (e.g. from Android Notification Forwarder)
    const rawNotification = text || message || content || title || (typeof req.body === 'string' ? req.body : '');
    if (rawNotification && (!amount || !currency)) {
      // Common ABA notifications: "You have received USD 15.99 from JOHN DOE (acc ...)" or "Received $10.00" or "40,000 KHR"
      const usdMatch = rawNotification.match(/(?:USD|\$)\s*([\d,]+(?:\.\d{1,2})?)/i) || rawNotification.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:USD|\$)/i);
      const khrMatch = rawNotification.match(/(?:KHR|៛)\s*([\d,]+)/i) || rawNotification.match(/([\d,]+)\s*(?:KHR|៛)/i);
      
      if (usdMatch) {
        amount = usdMatch[1].replace(/,/g, '');
        currency = 'USD';
      } else if (khrMatch) {
        amount = khrMatch[1].replace(/,/g, '');
        currency = 'KHR';
      }

      const fromMatch = rawNotification.match(/from\s+([A-Za-z\s]+?)(?:\s+to|\s+via|\.|\(|$)/i);
      if (fromMatch) {
        payerName = fromMatch[1].trim();
      }
    }

    const identifier = tran_id || billNo || req.body?.md5;

    console.log('[KHQR Webhook Received]', { rawNotification, parsedAmount: amount, currency, payerName });
    const confirmed = confirmPayment(identifier, {
      transactionId: tran_id || hash || 'TRX-' + Date.now(),
      amount,
      currency: currency || 'USD',
      payerName: payerName || 'ABA Customer',
      source: rawNotification ? 'Phone Notification' : 'Webhook'
    });

    res.json({
      success: true,
      message: 'Payment notification processed & broadcasted to POS in real time.',
      data: confirmed
    });
  } catch (error) {
    console.error('Error in KHQR webhook:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/khqr/simulate - Instant test button for cashier/demo
app.post('/api/khqr/simulate', (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SIMULATION !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Payment simulation is disabled in production environment.'
      });
    }

    const { sessionId, amount, currency } = req.body;
    const targetId = sessionId || Array.from(paymentSessions.keys())[0] || 'pay_demo';
    
    const confirmed = confirmPayment(targetId, {
      amount,
      currency,
      payerName: 'Sok San (ABA Mobile Demo)',
      source: 'Cashier Simulation'
    });

    res.json({
      success: true,
      message: 'Real-time payment simulated successfully!',
      data: confirmed
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================================
// 7. Production Static Asset Serving (Frontend React Build)
// ==========================================================
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  console.log(`[Static] Serving production frontend build from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Production Error Handling Middleware
app.use(errorHandler);

// Start Server with HTTP & WebSockets
async function startServer() {
  await initDatabase();
  
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/payments' });

  wss.on('connection', (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({ event: 'connected', message: 'Hachi POS Real-Time Payment Socket Connected' }));
    
    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
        if (data.type === 'simulate') confirmPayment(data.sessionId);
      } catch (e) {}
    });

    ws.on('close', () => wsClients.delete(ws));
    ws.on('error', () => wsClients.delete(ws));
  });

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  Hachi Tech POS & Inventory Backend Server Running!   `);
    console.log(`  Local Endpoint: http://localhost:${PORT}             `);
    console.log(`  Health Check:   http://localhost:${PORT}/api/health  `);
    console.log(`  KHQR Webhook:   http://localhost:${PORT}/api/khqr/webhook`);
    console.log(`  Real-time WS:   ws://localhost:${PORT}/ws/payments   `);
    console.log(`=======================================================`);
    
    // Start Telegram Live Payment Poller (@live_payment_bot)
    startTelegramPoller();
  });
}

startServer();
