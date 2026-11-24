/**
 * ESC/POS Thermal Receipt Command Generator
 * Formatted for standard 80mm thermal printers (48 columns per line)
 * Supports Epson, Star, Xprinter, Munbyn, Rongta, Citizen ESC/POS protocols.
 * Includes Dual Currency (USD / KHR), Serial Numbers, Warranty, and Cash Drawer Kick (ESC p)
 */

// ESC/POS Byte Constants
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

class EscPosBuilder {
  constructor() {
    this.buffer = [];
  }

  // Initialize printer (resets all settings)
  init() {
    this.buffer.push(ESC, 0x40);
    return this;
  }

  // Set text alignment: 0 = Left, 1 = Center, 2 = Right
  align(alignment = 'left') {
    const val = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(ESC, 0x61, val);
    return this;
  }

  // Bold / Emphasized mode
  bold(enable = true) {
    this.buffer.push(ESC, 0x45, enable ? 1 : 0);
    return this;
  }

  // Font sizing: 'normal', 'double-height', 'double-width', 'large'
  size(mode = 'normal') {
    let byte = 0x00;
    if (mode === 'large' || mode === 'double') byte = 0x11; // Double width + double height
    else if (mode === 'double-height') byte = 0x01;
    else if (mode === 'double-width') byte = 0x10;
    this.buffer.push(GS, 0x21, byte);
    return this;
  }

  // Add raw ASCII text
  text(str = '') {
    const bytes = Buffer.from(str, 'ascii');
    for (const b of bytes) {
      this.buffer.push(b);
    }
    return this;
  }

  // Add text with line feed
  line(str = '') {
    this.text(str);
    this.buffer.push(LF);
    return this;
  }

  // Blank lines
  feed(count = 1) {
    for (let i = 0; i < count; i++) {
      this.buffer.push(LF);
    }
    return this;
  }

  // Pop Cash Drawer via RJ11 printer port (ESC p 0 25 250)
  openCashDrawer() {
    this.buffer.push(ESC, 0x70, 0x00, 0x19, 0xFA);
    return this;
  }

  // Dashed separator line for 80mm thermal (48 columns)
  divider(char = '-') {
    this.align('left');
    this.size('normal');
    this.bold(false);
    this.line(char.repeat(48));
    return this;
  }

  // Double divider line
  doubleDivider() {
    return this.divider('=');
  }

  // 2-Column row: left aligned label, right aligned value (total 48 chars)
  row(left = '', right = '', totalWidth = 48) {
    const leftStr = String(left);
    const rightStr = String(right);
    const spaces = Math.max(1, totalWidth - leftStr.length - rightStr.length);
    this.line(leftStr + ' '.repeat(spaces) + rightStr);
    return this;
  }

  // 3-Column item line with optional S/N & Warranty Period
  itemRow(name, qty, unitPrice, subtotal, serialNumber = '', warranty = '', totalWidth = 48) {
    const left = `${qty}x ${name}`;
    const right = `$${parseFloat(subtotal).toFixed(2)}`;
    
    if (left.length + right.length + 1 <= totalWidth) {
      this.row(left, right, totalWidth);
    } else {
      this.line(left.slice(0, totalWidth));
      const sub = `   @ $${parseFloat(unitPrice).toFixed(2)}`;
      this.row(sub, right, totalWidth);
    }

    // Print Serial Number & Warranty Details on dedicated line
    if (serialNumber || warranty) {
      const details = [];
      if (serialNumber) details.push(`S/N: ${serialNumber}`);
      if (warranty) details.push(`Wty: ${warranty}`);
      this.line(`   [${details.join(' | ')}]`);
    }

    return this;
  }

  // Barcode (Code 128)
  barcode(code, height = 60) {
    this.align('center');
    this.buffer.push(GS, 0x68, height); // Barcode height
    this.buffer.push(GS, 0x77, 2);      // Barcode width multiplier
    this.buffer.push(GS, 0x48, 2);      // Print HRI characters below barcode
    
    const codeBytes = Buffer.from(code, 'ascii');
    this.buffer.push(GS, 0x6B, 73, codeBytes.length);
    for (const b of codeBytes) {
      this.buffer.push(b);
    }
    this.buffer.push(LF);
    return this;
  }

  // Paper cut command (Partial cut with feed)
  cut() {
    this.feed(3);
    this.buffer.push(GS, 0x56, 0x42, 0x00);
    return this;
  }

  toBuffer() {
    return Buffer.from(this.buffer);
  }

  toBase64() {
    return this.toBuffer().toString('base64');
  }

  toHex() {
    return this.toBuffer().toString('hex');
  }
}

/**
 * Builds standard 80mm ESC/POS byte sequence for a sales receipt
 * (Supports Dual Currency USD + KHR, S/N, Warranty, and Cash Drawer Pop)
 */
function buildEscPosReceipt(sale, storeInfo = {}) {
  const store = {
    name: storeInfo.name || process.env.STORE_NAME || 'HACHI TECH & IT SOLUTIONS',
    address: storeInfo.address || process.env.STORE_ADDRESS || 'Building 42, St. 2004, Phnom Penh',
    phone: storeInfo.phone || process.env.STORE_PHONE || '+855 23 888 999',
    taxId: storeInfo.taxId || process.env.STORE_TAX_ID || 'VAT: KHM-2026-90412'
  };

  const builder = new EscPosBuilder();

  // 1. Kick Cash Drawer if Cash sale
  if (sale.payment_method === 'cash') {
    builder.openCashDrawer();
  }

  const rate = parseFloat(sale.exchange_rate || 4100);
  const totalKhr = Math.round(parseFloat(sale.total_amount) * rate);
  const changeKhr = Math.round(parseFloat(sale.change_due || 0) * rate);

  builder
    .init()
    .align('center')
    .size('large')
    .bold(true)
    .line(store.name)
    .size('normal')
    .bold(false)
    .line(store.address)
    .line(`Tel: ${store.phone} | ${store.taxId}`)
    .divider('=')
    .align('left')
    .bold(true)
    .line(`INVOICE: ${sale.invoice_no}`)
    .bold(false)
    .row(`Date: ${new Date(sale.created_at || Date.now()).toLocaleString()}`, `Cashier: ${sale.cashier_name || 'Admin'}`)
    .row(`Ex. Rate: $1 = ${rate.toLocaleString()} KHR`, `Method: ${sale.payment_method.toUpperCase()}`)
    .divider('-')
    .bold(true)
    .row('ITEM DESCRIPTION', 'TOTAL (USD)')
    .bold(false)
    .divider('-');

  // Itemized line items with S/N & Warranty
  if (Array.isArray(sale.items)) {
    for (const item of sale.items) {
      builder.itemRow(
        item.product_name,
        item.quantity,
        item.unit_price,
        item.subtotal,
        item.serial_number || '',
        item.warranty_period || ''
      );
    }
  }

  builder
    .divider('-')
    .row('Subtotal (USD):', `$${parseFloat(sale.subtotal).toFixed(2)}`);

  if (parseFloat(sale.discount) > 0) {
    builder.row('Discount:', `-$${parseFloat(sale.discount).toFixed(2)}`);
  }

  if (parseFloat(sale.tax) > 0) {
    builder.row('Tax / VAT:', `+$${parseFloat(sale.tax).toFixed(2)}`);
  }

  builder
    .doubleDivider()
    .bold(true)
    .size('double-height')
    .row('TOTAL (USD):', `$${parseFloat(sale.total_amount).toFixed(2)}`)
    .size('normal')
    .bold(true)
    .row('TOTAL (KHR):', `${totalKhr.toLocaleString()} KHR`)
    .bold(false)
    .doubleDivider()
    .row(`Paid: $${parseFloat(sale.amount_received).toFixed(2)}`, `Method: ${sale.payment_method.toUpperCase()}`);

  if (sale.payment_method.toLowerCase() === 'cash') {
    builder
      .row('Change Due (USD):', `$${parseFloat(sale.change_due).toFixed(2)}`)
      .row('Change Due (KHR):', `${changeKhr.toLocaleString()} KHR`);
  }

  builder
    .divider('-')
    .align('center')
    .barcode(sale.invoice_no)
    .line(sale.invoice_no)
    .feed(1)
    .line('Thank you for shopping at Hachi Tech!')
    .line('WARRANTY NOTICE:')
    .line('Serial numbers must match receipt for warranty RMA.')
    .feed(1)
    .line('*** CUSTOMER COPY ***')
    .cut();

  return {
    rawBuffer: builder.toBuffer(),
    base64: builder.toBase64(),
    hex: builder.toHex(),
    byteLength: builder.buffer.length
  };
}

/**
 * Builds 80mm ESC/POS End-of-Day Z-Report Slip
 */
function buildZReportEscPos(shift, storeInfo = {}) {
  const storeName = storeInfo.name || process.env.STORE_NAME || 'HACHI TECH & IT SOLUTIONS';
  const builder = new EscPosBuilder();

  const openTime = new Date(shift.opened_at).toLocaleString();
  const closeTime = shift.closed_at ? new Date(shift.closed_at).toLocaleString() : new Date().toLocaleString();

  builder
    .init()
    .align('center')
    .size('large')
    .bold(true)
    .line(storeName)
    .size('normal')
    .line('*** END OF DAY Z-REPORT ***')
    .divider('=')
    .align('left')
    .row(`Shift No: ${shift.shift_no}`, `Status: ${shift.status.toUpperCase()}`)
    .row(`Cashier: ${shift.cashier_name}`, '')
    .line(`Opened: ${openTime}`)
    .line(`Closed: ${closeTime}`)
    .divider('-')
    .bold(true)
    .line('REVENUE BY PAYMENT METHOD')
    .bold(false)
    .row('Cash Sales:', `$${parseFloat(shift.cash_sales).toFixed(2)}`)
    .row('KHQR (Bakong):', `$${parseFloat(shift.khqr_sales).toFixed(2)}`)
    .row('Credit/Debit Card:', `$${parseFloat(shift.card_sales).toFixed(2)}`)
    .divider('-')
    .bold(true)
    .row('TOTAL GROSS SALES:', `$${parseFloat(shift.total_sales).toFixed(2)}`)
    .bold(false)
    .divider('=')
    .bold(true)
    .line('CASH DRAWER RECONCILIATION')
    .bold(false)
    .row('Opening Float:', `$${parseFloat(shift.opening_float).toFixed(2)}`)
    .row('+ Cash Sales:', `$${parseFloat(shift.cash_sales).toFixed(2)}`)
    .row('= Expected Cash in Drawer:', `$${parseFloat(shift.expected_cash).toFixed(2)}`)
    .row('Actual Counted Cash:', `$${parseFloat(shift.counted_cash).toFixed(2)}`);

  const diff = parseFloat(shift.cash_difference || 0);
  const diffSign = diff >= 0 ? `+$${diff.toFixed(2)} (OVER)` : `-$${Math.abs(diff).toFixed(2)} (SHORT)`;
  
  builder
    .bold(true)
    .row('DRAWER VARIANCE:', diffSign)
    .bold(false)
    .divider('-');

  if (shift.notes) {
    builder.line(`Notes: ${shift.notes}`);
  }

  builder
    .feed(2)
    .line('Cashier Signature: _________________________')
    .feed(1)
    .line('Manager Signature: _________________________')
    .feed(1)
    .align('center')
    .line('*** END OF SHIFT AUDIT COPY ***')
    .cut();

  return {
    rawBuffer: builder.toBuffer(),
    base64: builder.toBase64(),
    hex: builder.toHex(),
    byteLength: builder.buffer.length
  };
}

module.exports = {
  EscPosBuilder,
  buildEscPosReceipt,
  buildZReportEscPos
};
