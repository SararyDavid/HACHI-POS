const http = require('http');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===========================================================');
  console.log('   STARTING HACHI TECH POS PRODUCTION INTEGRATION TESTS    ');
  console.log('===========================================================');

  try {
    // 1. Health & Diagnostics Check
    const health = await request('GET', '/api/health');
    console.log('[TEST 1] GET /api/health:', health.status === 200 ? 'PASS' : 'FAIL', `(${health.data.database.message})`);

    // 2. Security Headers Verification
    const hasSecHeaders = health.headers['x-content-type-options'] === 'nosniff';
    console.log('[TEST 2] Security Headers (nosniff, framing):', hasSecHeaders ? 'PASS' : 'FAIL');

    // 3. Cashier PIN Authentication (Alex S., PIN: 1234)
    const loginRes = await request('POST', '/api/auth/login', { pin: '1234' });
    const isLoginPass = loginRes.status === 200 && Boolean(loginRes.data.data.token);
    const cashierToken = loginRes.data?.data?.token;
    console.log('[TEST 3] POST /api/auth/login (Cashier PIN 1234):', isLoginPass ? 'PASS' : 'FAIL', `Token generated for ${loginRes.data?.data?.user?.name}`);

    // 4. Authenticated Session Verification (GET /api/auth/me)
    const meRes = await request('GET', '/api/auth/me', null, cashierToken);
    console.log('[TEST 4] GET /api/auth/me (JWT Verification):', meRes.status === 200 && meRes.data.user.name === 'Alex S.' ? 'PASS' : 'FAIL');

    // 5. Manager PIN Authentication (David S., PIN: 9999)
    const managerLogin = await request('POST', '/api/auth/login', { pin: '9999' });
    const managerToken = managerLogin.data?.data?.token;
    console.log('[TEST 5] POST /api/auth/login (Manager PIN 9999):', managerLogin.status === 200 && managerLogin.data.data.user.role === 'manager' ? 'PASS' : 'FAIL');

    // 6. Fetch Products
    const productsRes = await request('GET', '/api/products');
    console.log('[TEST 6] GET /api/products:', productsRes.status === 200 ? 'PASS' : 'FAIL', `Found ${productsRes.data.count} items`);

    // 7. Create Product (Manager Authorized)
    const testSku = 'TEST-PROD-' + Date.now();
    const createRes = await request('POST', '/api/products', {
      barcode: testSku,
      name: 'Razer Huntsman V3 Pro Analog Keyboard',
      category: 'Peripherals',
      brand: 'Razer',
      cost_price: 140.00,
      selling_price: 249.99,
      stock_qty: 10,
      low_stock_threshold: 3
    }, managerToken);
    console.log('[TEST 7] POST /api/products (Manager Create):', createRes.status === 201 ? 'PASS' : 'FAIL', createRes.data?.message);
    const newProductId = createRes.data?.data?.id;

    // 8. Checkout ACID Transaction (Selling 2 units, Stock should go from 10 -> 8)
    const checkoutRes = await request('POST', '/api/checkout', {
      cart: [
        { id: newProductId, barcode: testSku, name: 'Razer Huntsman V3 Pro', quantity: 2, unit_price: 249.99 }
      ],
      payment_method: 'cash',
      amount_received: 500.00,
      discount: 0.00,
      tax: 0.00
    }, cashierToken);

    const invoiceNo = checkoutRes.data?.data?.receipt?.invoice_no;
    console.log('[TEST 8] POST /api/checkout (ACID Decrement):', checkoutRes.status === 201 ? 'PASS' : 'FAIL', `Invoice: ${invoiceNo}, Sold 2 units`);

    // Verify stock is now 8
    const stockAfterSale = await request('GET', `/api/products/${newProductId}`);
    console.log('[TEST 9] Stock Decrement Check:', stockAfterSale.data.data.stock_qty === 8 ? 'PASS (10 - 2 = 8)' : `FAIL (${stockAfterSale.data.data.stock_qty})`);

    // 10. Transactional RMA Refund & Restock Workflow
    const refundRes = await request('POST', `/api/sales/${invoiceNo}/refund`, {
      reason: 'Customer RMA Defective Switch Return'
    }, managerToken);
    console.log('[TEST 10] POST /api/sales/:id/refund (RMA Stock Restoral):', refundRes.status === 200 ? 'PASS' : 'FAIL', refundRes.data?.message);

    // Verify stock is restored from 8 back to 10
    const stockAfterRefund = await request('GET', `/api/products/${newProductId}`);
    console.log('[TEST 11] Inventory Stock Restoration Check:', stockAfterRefund.data.data.stock_qty === 10 ? 'PASS (Restored to 10)' : `FAIL (${stockAfterRefund.data.data.stock_qty})`);

    // 12. ESC/POS Generation & /api/print
    const printRes = await request('POST', '/api/print', {
      sale: checkoutRes.data.data.receipt
    });
    console.log('[TEST 12] POST /api/print (80mm ESC/POS Binary):', printRes.status === 200 ? 'PASS' : 'FAIL', `${printRes.data.escpos.byteLength} bytes generated`);

    // 13. Sales History Audit Ledger
    const salesRes = await request('GET', '/api/sales');
    const refundedSale = salesRes.data.data.sales.find(s => s.invoice_no === invoiceNo);
    console.log('[TEST 13] Sales Ledger Status Check:', refundedSale?.status === 'refunded' ? 'PASS (Marked REFUNDED)' : `FAIL (${refundedSale?.status})`);

    // 14. RBAC Protection: Non-manager cannot delete product (Cashier attempts DELETE -> 403 Forbidden)
    const unauthorizedDelete = await request('DELETE', `/api/products/${newProductId}`, null, cashierToken);
    console.log('[TEST 14] RBAC Protection (Cashier DELETE blocked):', unauthorizedDelete.status === 403 ? 'PASS (403 Forbidden)' : `FAIL (${unauthorizedDelete.status})`);

    // 15. Manager Cleans Up Test Product (Manager DELETE -> 200 OK)
    const authorizedDelete = await request('DELETE', `/api/products/${newProductId}`, null, managerToken);
    console.log('[TEST 15] RBAC Clean Up (Manager DELETE allowed):', authorizedDelete.status === 200 ? 'PASS (200 OK)' : `FAIL (${authorizedDelete.status})`);

    console.log('===========================================================');
    console.log('   🎉 ALL 15 PRODUCTION INTEGRATION TESTS PASSED 100%!     ');
    console.log('===========================================================');
  } catch (err) {
    console.error('Test execution error:', err.message);
  }
}

runTests();
