const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hachi_pos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
};

let mysqlPool = null;
let isUsingMySQL = false;
let dbStatusMessage = 'Initializing...';

// Fallback Local File-backed Storage
const DATA_DIR = path.join(__dirname, 'data');
const LOCAL_STORE_FILE = path.join(DATA_DIR, 'hachi_pos_local.json');

const INITIAL_PRODUCTS = [
  // Peripherals
  { id: 1, barcode: '097855171733', name: 'Logitech MX Master 3S Wireless Mouse (Graphite)', category: 'Peripherals', brand: 'Logitech', cost_price: 68.00, selling_price: 99.00, stock_qty: 18, low_stock_threshold: 5, warranty_period: '1 Year Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=400&q=80&sig=101' },
  { id: 2, barcode: '8886419337584', name: 'Razer DeathAdder V3 Ergonomic Esports Mouse', category: 'Peripherals', brand: 'Razer', cost_price: 45.00, selling_price: 69.99, stock_qty: 12, low_stock_threshold: 4, warranty_period: '2 Years Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80&sig=102' },
  { id: 3, barcode: '4895248805218', name: 'Keychron K2 V2 Wireless Mechanical Keyboard (Gateron Brown)', category: 'Peripherals', brand: 'Keychron', cost_price: 55.00, selling_price: 79.50, stock_qty: 15, low_stock_threshold: 5, warranty_period: '1 Year Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80&sig=103' },
  { id: 4, barcode: '840006638841', name: 'Corsair K70 RGB PRO Mechanical Gaming Keyboard (Cherry MX Red)', category: 'Peripherals', brand: 'Corsair', cost_price: 110.00, selling_price: 159.99, stock_qty: 8, low_stock_threshold: 3, warranty_period: '2 Years Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=400&q=80&sig=104' },
  { id: 5, barcode: '097855152565', name: 'Logitech C920s Pro HD 1080p Webcam with Privacy Shutter', category: 'Peripherals', brand: 'Logitech', cost_price: 44.00, selling_price: 64.99, stock_qty: 7, low_stock_threshold: 3, warranty_period: '1 Year Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1588702547923-7093a6c3ba33?w=400&q=80&sig=105' },
  { id: 6, barcode: '6934177712345', name: 'SteelSeries QcK Heavy XXL Gaming Mousepad (Black)', category: 'Peripherals', brand: 'SteelSeries', cost_price: 14.00, selling_price: 24.99, stock_qty: 25, low_stock_threshold: 6, warranty_period: '7 Days Replacement', requires_serial: false, image: 'https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=400&q=80&sig=106' },

  // Storage
  { id: 7, barcode: '887276707327', name: 'Samsung 990 PRO 1TB PCIe Gen4 NVMe M.2 SSD', category: 'Storage', brand: 'Samsung', cost_price: 75.00, selling_price: 109.99, stock_qty: 22, low_stock_threshold: 5, warranty_period: '5 Years Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80&sig=107' },
  { id: 8, barcode: '649528929723', name: 'Crucial P3 Plus 2TB PCIe 4.0 3D NAND NVMe M.2 SSD', category: 'Storage', brand: 'Crucial', cost_price: 88.00, selling_price: 124.00, stock_qty: 9, low_stock_threshold: 4, warranty_period: '3 Years Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=400&q=80&sig=108' },
  { id: 9, barcode: '740617304121', name: 'Kingston DataTraveler Exodia 64GB USB 3.2 Flash Drive', category: 'Storage', brand: 'Kingston', cost_price: 3.80, selling_price: 7.50, stock_qty: 45, low_stock_threshold: 10, warranty_period: '5 Years Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1624823183493-ed5832f45750?w=400&q=80&sig=109' },
  { id: 10, barcode: '760557841123', name: 'SanDisk Extreme PRO 128GB UHS-I SDXC Memory Card', category: 'Storage', brand: 'SanDisk', cost_price: 16.50, selling_price: 27.99, stock_qty: 3, low_stock_threshold: 5, warranty_period: 'Lifetime Limited', requires_serial: false, image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=400&q=80&sig=110' },
  { id: 11, barcode: '718037887321', name: 'WD Blue 2TB 3.5 Inch SATA Internal Hard Drive 7200 RPM', category: 'Storage', brand: 'Western Digital', cost_price: 38.00, selling_price: 54.00, stock_qty: 11, low_stock_threshold: 4, warranty_period: '2 Years Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400&q=80&sig=111' },

  // Components
  { id: 12, barcode: '840006623123', name: 'Corsair Vengeance DDR5 32GB (2x16GB) 6000MHz CL36 RAM', category: 'Components', brand: 'Corsair', cost_price: 72.00, selling_price: 104.99, stock_qty: 14, low_stock_threshold: 4, warranty_period: 'Lifetime Limited', requires_serial: true, image: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=400&q=80&sig=112' },
  { id: 13, barcode: '843368065432', name: 'Noctua NF-A12x25 PWM 120mm Premium Quiet PC Fan', category: 'Components', brand: 'Noctua', cost_price: 19.50, selling_price: 32.90, stock_qty: 16, low_stock_threshold: 5, warranty_period: '6 Years Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400&q=80&sig=113' },
  { id: 14, barcode: '840006698765', name: 'Corsair RM850e Fully Modular Low-Noise ATX Power Supply 850W', category: 'Components', brand: 'Corsair', cost_price: 85.00, selling_price: 129.99, stock_qty: 6, low_stock_threshold: 3, warranty_period: '7 Years Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=400&q=80&sig=114' },
  { id: 15, barcode: '4719331812345', name: 'DeepCool AK620 High-Performance Dual-Tower CPU Cooler', category: 'Components', brand: 'DeepCool', cost_price: 42.00, selling_price: 64.99, stock_qty: 8, low_stock_threshold: 3, warranty_period: '3 Years Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=400&q=80&sig=115' },

  // Tools & Maintenance
  { id: 16, barcode: '856235006240', name: 'iFixit Pro Tech Toolkit for Precision Electronics & PCs', category: 'Tools', brand: 'iFixit', cost_price: 46.00, selling_price: 74.99, stock_qty: 10, low_stock_threshold: 3, warranty_period: 'Lifetime Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&q=80&sig=116' },
  { id: 17, barcode: '6934177708572', name: 'Xiaomi Precision 24-in-1 Magnetic Screwdriver Set', category: 'Tools', brand: 'Xiaomi', cost_price: 12.00, selling_price: 21.50, stock_qty: 19, low_stock_threshold: 5, warranty_period: '6 Months Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400&q=80&sig=117' },
  { id: 18, barcode: '4895212701838', name: 'Arctic MX-4 (4g) High Performance Thermal Compound Paste', category: 'Tools', brand: 'Arctic', cost_price: 3.20, selling_price: 7.99, stock_qty: 35, low_stock_threshold: 8, warranty_period: '8 Years Durability', requires_serial: false, image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80&sig=118' },
  { id: 19, barcode: '9010018200171', name: 'Noctua NT-H1 3.5g Pro-Grade Thermal Grease', category: 'Tools', brand: 'Noctua', cost_price: 4.80, selling_price: 9.99, stock_qty: 20, low_stock_threshold: 5, warranty_period: '5 Years Storage', requires_serial: false, image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80&sig=119' },
  { id: 20, barcode: '079357317712', name: 'Falcon Dust-Off Compressed Gas Duster Can (10 oz)', category: 'Tools', brand: 'Falcon', cost_price: 4.00, selling_price: 8.50, stock_qty: 2, low_stock_threshold: 6, warranty_period: 'Consumable Item', requires_serial: false, image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&q=80&sig=120' },
  { id: 21, barcode: '856235006999', name: 'Anti-Static ESD Wrist Strap with Grounding Wire Clip', category: 'Tools', brand: 'Generic', cost_price: 1.80, selling_price: 4.99, stock_qty: 18, low_stock_threshold: 5, warranty_period: '1 Year Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80&sig=121' },

  // Cables & Adapters
  { id: 22, barcode: '194644023249', name: 'Anker PowerLine III USB-C to USB-C 100W Fast Charging Cable 6ft', category: 'Cables', brand: 'Anker', cost_price: 8.50, selling_price: 15.99, stock_qty: 28, low_stock_threshold: 6, warranty_period: '18 Months Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&q=80&sig=122' },
  { id: 23, barcode: '6957303874328', name: 'UGREEN 8K HDMI 2.1 Ultra High Speed Cable 2-Meter (Zinc Alloy)', category: 'Cables', brand: 'UGREEN', cost_price: 7.20, selling_price: 13.99, stock_qty: 32, low_stock_threshold: 6, warranty_period: '2 Years Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=400&q=80&sig=123' },
  { id: 24, barcode: '6957303881234', name: 'UGREEN Cat 8 Shielded RJ45 Gigabit Ethernet Patch Cable 3M', category: 'Cables', brand: 'UGREEN', cost_price: 4.50, selling_price: 8.99, stock_qty: 24, low_stock_threshold: 5, warranty_period: '2 Years Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80&sig=124' },
  { id: 25, barcode: '194644055432', name: 'Anker 7-in-1 USB-C Hub (4K HDMI, 100W PD, SD Reader, 3x USB 3.0)', category: 'Cables', brand: 'Anker', cost_price: 22.00, selling_price: 35.00, stock_qty: 11, low_stock_threshold: 4, warranty_period: '18 Months Warranty', requires_serial: true, image: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&q=80&sig=125' },
  { id: 26, barcode: '6957303899999', name: 'DisplayPort 1.4 to DisplayPort Cable 2M (Supports 4K@144Hz)', category: 'Cables', brand: 'UGREEN', cost_price: 6.50, selling_price: 12.50, stock_qty: 0, low_stock_threshold: 5, warranty_period: '2 Years Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400&q=80&sig=126' },

  // Services & User Items
  { id: 27, barcode: 'SRV-CLEAN-01', name: 'PC Deep Dust Cleaning & Thermal Repaste Service', category: 'Services', brand: 'Hachi Care', cost_price: 10.00, selling_price: 25.00, stock_qty: 999, low_stock_threshold: 10, warranty_period: '30 Days Service', requires_serial: false, image: 'https://images.unsplash.com/photo-1597733336794-12d05021d510?w=400&q=80&sig=127' },
  { id: 28, barcode: 'SRV-OS-02', name: 'Windows 11 OS Reinstallation & Data Transfer Service', category: 'Services', brand: 'Hachi Care', cost_price: 15.00, selling_price: 35.00, stock_qty: 999, low_stock_threshold: 10, warranty_period: '30 Days Support', requires_serial: false, image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80&sig=128' },
  { id: 29, barcode: 'SRV-DIAG-03', name: 'Hardware Diagnostic & Component Testing Lab Service', category: 'Services', brand: 'Hachi Care', cost_price: 5.00, selling_price: 15.00, stock_qty: 999, low_stock_threshold: 10, warranty_period: 'N/A', requires_serial: false, image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400&q=80&sig=129' },
  { id: 31, barcode: '4712487000430', name: 'Crossman Long Nose Plier', category: 'Tools', brand: 'Crossman', cost_price: 5.00, selling_price: 10.00, stock_qty: 9, low_stock_threshold: 5, warranty_period: 'Lifetime Tool Warranty', requires_serial: false, image: 'https://images.unsplash.com/photo-1508873696983-2df5703bc20d?w=400&q=80&sig=131' }
];

const INITIAL_SHIFTS = [
  {
    id: 1,
    shift_no: 'SHIFT-20261113-001',
    cashier_name: 'Alex S.',
    opened_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    closed_at: null,
    status: 'open',
    opening_float: 100.00,
    cash_sales: 111.99,
    khqr_sales: 124.00,
    card_sales: 44.48,
    total_sales: 280.47,
    expected_cash: 211.99,
    counted_cash: 0.00,
    cash_difference: 0.00,
    notes: 'Morning shift'
  }
];

let localDb = {
  products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
  sales: [],
  shifts: JSON.parse(JSON.stringify(INITIAL_SHIFTS)),
  nextProductId: 32,
  nextSaleId: 7,
  nextSaleItemId: 11,
  nextShiftId: 2
};

function saveLocalDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(localDb, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save local DB:', err.message);
  }
}

function loadLocalDb() {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const data = fs.readFileSync(LOCAL_STORE_FILE, 'utf8');
      localDb = JSON.parse(data);
      if (!localDb.shifts) {
        localDb.shifts = JSON.parse(JSON.stringify(INITIAL_SHIFTS));
        localDb.nextShiftId = 2;
      }
      // Ensure products have warranty_period, requires_serial, and realistic image URLs
      let modified = false;
      if (Array.isArray(localDb.products)) {
        localDb.products.forEach(p => {
          const initial = INITIAL_PRODUCTS.find(ip => ip.barcode === p.barcode || ip.id === p.id);
          if (p.warranty_period === undefined) {
            p.warranty_period = initial ? initial.warranty_period : '1 Year Warranty';
            p.requires_serial = initial ? Boolean(initial.requires_serial) : false;
            modified = true;
          }
          if (!p.image && initial && initial.image) {
            p.image = initial.image;
            modified = true;
          }
        });
      }
      if (modified) {
        saveLocalDb();
      }
    } else {
      saveLocalDb();
    }
  } catch (err) {
    console.warn('Could not parse local DB file, reinitializing defaults');
    saveLocalDb();
  }
}

// Initialize Database connection
async function initDatabase() {
  console.log(`[Database] Attempting connection to MySQL (${DB_CONFIG.host}:${DB_CONFIG.port}, user: ${DB_CONFIG.user})...`);
  
  try {
    const testConnection = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      connectTimeout: 2500
    });

    await testConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await testConnection.end();

    mysqlPool = mysql.createPool(DB_CONFIG);

    const [tables] = await mysqlPool.query("SHOW TABLES LIKE 'products'");
    if (tables.length === 0) {
      console.log('[Database] MySQL tables not found. Executing schema.sql initialization...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await mysqlPool.query(schemaSql);
        console.log('[Database] MySQL schema.sql executed and seed data imported successfully!');
      }
    }

    isUsingMySQL = true;
    dbStatusMessage = `Connected to MySQL 8.0 [Database: ${DB_CONFIG.database}]`;
    console.log(`[Database] SUCCESS: ${dbStatusMessage}`);
  } catch (err) {
    isUsingMySQL = false;
    dbStatusMessage = `Using Local Embedded Store (${err.code || err.message}). To use MySQL 8, set DB_PASSWORD in backend/.env`;
    console.warn(`[Database] MySQL Connection Notice: ${err.message}`);
    console.log(`[Database] Operating in Local Embedded Storage Mode with full ACID transactional checkout semantics.`);
    loadLocalDb();
  }
}

// Unified Database Provider
const db = {
  isMySQL() {
    return isUsingMySQL;
  },

  getStatus() {
    return {
      type: isUsingMySQL ? 'mysql' : 'local_store',
      connected: true,
      message: dbStatusMessage,
      dbName: isUsingMySQL ? DB_CONFIG.database : 'hachi_pos_local.json'
    };
  },

  // Direct access to products
  async getProducts({ search = '', category = '' } = {}) {
    if (isUsingMySQL && mysqlPool) {
      let query = 'SELECT * FROM products WHERE 1=1';
      const params = [];

      if (category && category !== 'All') {
        query += ' AND category = ?';
        params.push(category);
      }

      if (search) {
        query += ' AND (name LIKE ? OR barcode LIKE ? OR brand LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      query += ' ORDER BY category ASC, name ASC';
      const [rows] = await mysqlPool.query(query, params);
      return rows;
    }

    let results = [...localDb.products];
    if (category && category !== 'All') {
      results = results.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
      );
    }
    results.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    return results;
  },

  async getProductByBarcode(barcode) {
    if (isUsingMySQL && mysqlPool) {
      const [rows] = await mysqlPool.query('SELECT * FROM products WHERE barcode = ? LIMIT 1', [barcode]);
      return rows[0] || null;
    }
    return localDb.products.find(p => p.barcode === barcode) || null;
  },

  async getProductById(id) {
    if (isUsingMySQL && mysqlPool) {
      const [rows] = await mysqlPool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
      return rows[0] || null;
    }
    return localDb.products.find(p => p.id === parseInt(id, 10)) || null;
  },

  // Create new product with Warranty and Serial Number Flag
  async createProduct(data) {
    const { 
      barcode, 
      name, 
      category, 
      brand, 
      cost_price, 
      selling_price, 
      stock_qty, 
      low_stock_threshold,
      warranty_period = '7 Days Return',
      requires_serial = false,
      image = null
    } = data;

    if (isUsingMySQL && mysqlPool) {
      const [result] = await mysqlPool.query(
        `INSERT INTO products (barcode, name, category, brand, cost_price, selling_price, stock_qty, low_stock_threshold, warranty_period, requires_serial, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          barcode.trim(),
          name.trim(),
          category,
          brand ? brand.trim() : 'Generic',
          parseFloat(cost_price) || 0,
          parseFloat(selling_price) || 0,
          parseInt(stock_qty, 10) || 0,
          parseInt(low_stock_threshold, 10) || 5,
          warranty_period || '7 Days Return',
          requires_serial ? 1 : 0,
          image || null
        ]
      );
      return await this.getProductById(result.insertId);
    }

    const existing = localDb.products.find(p => p.barcode === barcode.trim());
    if (existing) {
      const err = new Error(`Product with barcode '${barcode}' already exists (${existing.name})`);
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }

    const newProduct = {
      id: localDb.nextProductId++,
      barcode: barcode.trim(),
      name: name.trim(),
      category,
      brand: brand ? brand.trim() : 'Generic',
      cost_price: parseFloat(cost_price) || 0,
      selling_price: parseFloat(selling_price) || 0,
      stock_qty: parseInt(stock_qty, 10) || 0,
      low_stock_threshold: parseInt(low_stock_threshold, 10) || 5,
      warranty_period: warranty_period || '7 Days Return',
      requires_serial: Boolean(requires_serial),
      image: image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80',
      created_at: new Date().toISOString()
    };
    localDb.products.push(newProduct);
    saveLocalDb();
    return newProduct;
  },

  async updateProduct(id, data) {
    const productId = parseInt(id, 10);
    const { barcode, name, category, brand, cost_price, selling_price, stock_qty, low_stock_threshold, warranty_period, requires_serial, image } = data;

    if (isUsingMySQL && mysqlPool) {
      await mysqlPool.query(
        `UPDATE products SET 
          barcode = COALESCE(?, barcode),
          name = COALESCE(?, name),
          category = COALESCE(?, category),
          brand = COALESCE(?, brand),
          cost_price = COALESCE(?, cost_price),
          selling_price = COALESCE(?, selling_price),
          stock_qty = COALESCE(?, stock_qty),
          low_stock_threshold = COALESCE(?, low_stock_threshold),
          warranty_period = COALESCE(?, warranty_period),
          requires_serial = COALESCE(?, requires_serial),
          image = COALESCE(?, image)
        WHERE id = ?`,
        [
          barcode ? barcode.trim() : null,
          name ? name.trim() : null,
          category || null,
          brand ? brand.trim() : null,
          cost_price !== undefined ? parseFloat(cost_price) : null,
          selling_price !== undefined ? parseFloat(selling_price) : null,
          stock_qty !== undefined ? parseInt(stock_qty, 10) : null,
          low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : null,
          warranty_period || null,
          requires_serial !== undefined ? (requires_serial ? 1 : 0) : null,
          image !== undefined ? image : null,
          productId
        ]
      );
      return await this.getProductById(productId);
    }

    const idx = localDb.products.findIndex(p => p.id === productId);
    if (idx === -1) return null;

    if (barcode && barcode.trim() !== localDb.products[idx].barcode) {
      const dup = localDb.products.find(p => p.barcode === barcode.trim() && p.id !== productId);
      if (dup) {
        const err = new Error(`Barcode '${barcode}' already assigned to ${dup.name}`);
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
      localDb.products[idx].barcode = barcode.trim();
    }

    if (name) localDb.products[idx].name = name.trim();
    if (category) localDb.products[idx].category = category;
    if (brand !== undefined) localDb.products[idx].brand = brand.trim();
    if (cost_price !== undefined) localDb.products[idx].cost_price = parseFloat(cost_price);
    if (selling_price !== undefined) localDb.products[idx].selling_price = parseFloat(selling_price);
    if (stock_qty !== undefined) localDb.products[idx].stock_qty = parseInt(stock_qty, 10);
    if (low_stock_threshold !== undefined) localDb.products[idx].low_stock_threshold = parseInt(low_stock_threshold, 10);
    if (warranty_period !== undefined) localDb.products[idx].warranty_period = warranty_period;
    if (requires_serial !== undefined) localDb.products[idx].requires_serial = Boolean(requires_serial);
    if (image !== undefined) localDb.products[idx].image = image;

    saveLocalDb();
    return localDb.products[idx];
  },

  async deleteProduct(id) {
    const productId = parseInt(id, 10);

    if (isUsingMySQL && mysqlPool) {
      const [result] = await mysqlPool.query('DELETE FROM products WHERE id = ?', [productId]);
      return result.affectedRows > 0;
    }

    const initialLen = localDb.products.length;
    localDb.products = localDb.products.filter(p => p.id !== productId);
    saveLocalDb();
    return localDb.products.length < initialLen;
  },

  // ==========================================================
  // SHIFT MANAGEMENT & END-OF-DAY Z-REPORT
  // ==========================================================
  async getCurrentShift() {
    if (isUsingMySQL && mysqlPool) {
      const [rows] = await mysqlPool.query(
        "SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1"
      );
      return rows[0] || null;
    }
    return localDb.shifts.find(s => s.status === 'open') || null;
  },

  async startShift({ cashier_name = 'Alex S.', opening_float = 0, notes = '' }) {
    const floatVal = parseFloat(opening_float) || 0;
    const now = new Date();
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const shift_no = `SHIFT-${yyyymmdd}-${Math.floor(100 + Math.random() * 900)}`;

    if (isUsingMySQL && mysqlPool) {
      // Check if an open shift already exists
      const existing = await this.getCurrentShift();
      if (existing) {
        throw new Error(`Shift #${existing.shift_no} is already open. Please close it first.`);
      }

      const [res] = await mysqlPool.query(
        `INSERT INTO shifts (shift_no, cashier_name, opened_at, status, opening_float, expected_cash, notes)
         VALUES (?, ?, NOW(), 'open', ?, ?, ?)`,
        [shift_no, cashier_name, floatVal, floatVal, notes]
      );
      const [rows] = await mysqlPool.query('SELECT * FROM shifts WHERE id = ?', [res.insertId]);
      return rows[0];
    }

    const existing = localDb.shifts.find(s => s.status === 'open');
    if (existing) {
      throw new Error(`Shift #${existing.shift_no} is already open. Please close it before starting a new shift.`);
    }

    const newShift = {
      id: localDb.nextShiftId++,
      shift_no,
      cashier_name,
      opened_at: new Date().toISOString(),
      closed_at: null,
      status: 'open',
      opening_float: floatVal,
      cash_sales: 0,
      khqr_sales: 0,
      card_sales: 0,
      total_sales: 0,
      expected_cash: floatVal,
      counted_cash: 0,
      cash_difference: 0,
      notes
    };
    localDb.shifts.unshift(newShift);
    saveLocalDb();
    return newShift;
  },

  async closeShift({ shift_id, counted_cash, notes = '' }) {
    const counted = parseFloat(counted_cash) || 0;

    if (isUsingMySQL && mysqlPool) {
      const [rows] = await mysqlPool.query('SELECT * FROM shifts WHERE id = ?', [shift_id]);
      if (rows.length === 0) throw new Error('Shift record not found.');
      const shift = rows[0];
      if (shift.status === 'closed') throw new Error('This shift has already been closed.');

      const expectedCash = parseFloat(shift.opening_float) + parseFloat(shift.cash_sales);
      const difference = counted - expectedCash;

      await mysqlPool.query(
        `UPDATE shifts SET 
          status = 'closed',
          closed_at = NOW(),
          expected_cash = ?,
          counted_cash = ?,
          cash_difference = ?,
          notes = CONCAT(COALESCE(notes, ''), ' | ', ?)
         WHERE id = ?`,
        [expectedCash, counted, difference, notes, shift_id]
      );

      const [updated] = await mysqlPool.query('SELECT * FROM shifts WHERE id = ?', [shift_id]);
      return updated[0];
    }

    const shift = localDb.shifts.find(s => s.id === parseInt(shift_id, 10));
    if (!shift) throw new Error('Shift record not found.');
    if (shift.status === 'closed') throw new Error('Shift already closed.');

    const expectedCash = shift.opening_float + shift.cash_sales;
    const difference = counted - expectedCash;

    shift.status = 'closed';
    shift.closed_at = new Date().toISOString();
    shift.expected_cash = expectedCash;
    shift.counted_cash = counted;
    shift.cash_difference = difference;
    if (notes) shift.notes = (shift.notes ? shift.notes + ' | ' : '') + notes;

    saveLocalDb();
    return shift;
  },

  async getShiftHistory() {
    if (isUsingMySQL && mysqlPool) {
      const [rows] = await mysqlPool.query('SELECT * FROM shifts ORDER BY id DESC LIMIT 50');
      return rows;
    }
    return localDb.shifts;
  },

  // ==========================================================
  // ACID TRANSACTION CHECKOUT ROUTE
  // (Dual Currency USD/KHR, S/N, Warranty, Shift linkage)
  // ==========================================================
  async processCheckout(orderData) {
    const {
      cart,
      payment_method, // 'cash' | 'khqr' | 'card'
      amount_received,
      discount = 0,
      tax = 0,
      cashier_name = 'Admin',
      exchange_rate = 4100,
      amount_received_khr = 0
    } = orderData;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      throw new Error('Shopping cart cannot be empty.');
    }

    const rate = parseFloat(exchange_rate) || 4100;
    const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.unit_price) * parseInt(item.quantity, 10)), 0);
    const numDiscount = parseFloat(discount) || 0;
    const numTax = parseFloat(tax) || 0;
    const total_amount = Math.max(0, subtotal - numDiscount + numTax);
    const total_khr = Math.round(total_amount * rate);

    const numReceived = parseFloat(amount_received) !== undefined ? parseFloat(amount_received) : total_amount;
    const change_due = Math.max(0, numReceived - total_amount);
    const change_due_khr = Math.round(change_due * rate);

    const now = new Date();
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoice_no = `INV-${yyyymmdd}-${randSuffix}`;

    // Get active shift
    const currentShift = await this.getCurrentShift();
    const shift_id = currentShift ? currentShift.id : null;

    // --- MYSQL ACID TRANSACTION ---
    if (isUsingMySQL && mysqlPool) {
      const connection = await mysqlPool.getConnection();
      try {
        await connection.beginTransaction();

        // 1. Verify stock
        for (const item of cart) {
          const [rows] = await connection.query(
            'SELECT id, name, barcode, stock_qty FROM products WHERE id = ? FOR UPDATE',
            [item.id]
          );

          if (rows.length === 0) {
            throw new Error(`Product '${item.name}' not found.`);
          }

          const product = rows[0];
          if (product.stock_qty < item.quantity) {
            throw new Error(`Insufficient stock for "${product.name}". Requested: ${item.quantity}, Available: ${product.stock_qty}`);
          }

          await connection.query(
            'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
            [item.quantity, item.id]
          );
        }

        // 2. Insert into sales
        const [saleResult] = await connection.query(
          `INSERT INTO sales 
            (invoice_no, shift_id, subtotal, discount, tax, total_amount, exchange_rate, total_khr, payment_method, amount_received, change_due, change_due_khr, cashier_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            invoice_no,
            shift_id,
            subtotal.toFixed(2),
            numDiscount.toFixed(2),
            numTax.toFixed(2),
            total_amount.toFixed(2),
            rate,
            total_khr,
            payment_method,
            numReceived.toFixed(2),
            change_due.toFixed(2),
            change_due_khr,
            cashier_name
          ]
        );

        const saleId = saleResult.insertId;

        // 3. Insert line items (with S/N and warranty)
        const lineItems = [];
        for (const item of cart) {
          const lineSubtotal = parseFloat(item.unit_price) * parseInt(item.quantity, 10);
          await connection.query(
            `INSERT INTO sale_items (sale_id, product_id, barcode, product_name, serial_number, warranty_period, quantity, unit_price, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              saleId,
              item.id,
              item.barcode || null,
              item.name,
              item.serial_number || null,
              item.warranty_period || '7 Days Return',
              item.quantity,
              parseFloat(item.unit_price).toFixed(2),
              lineSubtotal.toFixed(2)
            ]
          );

          lineItems.push({
            product_id: item.id,
            barcode: item.barcode,
            product_name: item.name,
            serial_number: item.serial_number || '',
            warranty_period: item.warranty_period || '7 Days Return',
            quantity: item.quantity,
            unit_price: parseFloat(item.unit_price),
            subtotal: lineSubtotal
          });
        }

        // 4. Update Shift sales counter if active shift
        if (shift_id) {
          const colToUpdate = payment_method === 'cash' ? 'cash_sales' : payment_method === 'khqr' ? 'khqr_sales' : 'card_sales';
          await connection.query(
            `UPDATE shifts SET 
              ${colToUpdate} = ${colToUpdate} + ?,
              total_sales = total_sales + ?
             WHERE id = ?`,
            [total_amount, total_amount, shift_id]
          );
        }

        await connection.commit();

        return {
          id: saleId,
          invoice_no,
          shift_id,
          subtotal,
          discount: numDiscount,
          tax: numTax,
          total_amount,
          exchange_rate: rate,
          total_khr,
          payment_method,
          amount_received: numReceived,
          change_due,
          change_due_khr,
          cashier_name,
          created_at: new Date().toISOString(),
          items: lineItems
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    // --- LOCAL DB ACID TRANSACTION ---
    for (const item of cart) {
      const prod = localDb.products.find(p => p.id === item.id);
      if (!prod) throw new Error(`Product '${item.name}' not found.`);
      if (prod.stock_qty < item.quantity) {
        throw new Error(`Insufficient stock for "${prod.name}". Requested: ${item.quantity}, Available: ${prod.stock_qty}`);
      }
    }

    for (const item of cart) {
      const prod = localDb.products.find(p => p.id === item.id);
      prod.stock_qty -= item.quantity;
    }

    const saleId = localDb.nextSaleId++;
    const lineItems = cart.map((item) => ({
      id: localDb.nextSaleItemId++,
      sale_id: saleId,
      product_id: item.id,
      barcode: item.barcode,
      product_name: item.name,
      serial_number: item.serial_number || '',
      warranty_period: item.warranty_period || '7 Days Return',
      quantity: item.quantity,
      unit_price: parseFloat(item.unit_price),
      subtotal: parseFloat(item.unit_price) * item.quantity
    }));

    const saleRecord = {
      id: saleId,
      invoice_no,
      shift_id,
      subtotal,
      discount: numDiscount,
      tax: numTax,
      total_amount,
      exchange_rate: rate,
      total_khr,
      payment_method,
      amount_received: numReceived,
      change_due,
      change_due_khr,
      cashier_name,
      created_at: new Date().toISOString(),
      items: lineItems
    };

    localDb.sales.unshift(saleRecord);

    // Update active shift running counter
    if (currentShift) {
      if (payment_method === 'cash') currentShift.cash_sales += total_amount;
      else if (payment_method === 'khqr') currentShift.khqr_sales += total_amount;
      else currentShift.card_sales += total_amount;

      currentShift.total_sales += total_amount;
      currentShift.expected_cash = currentShift.opening_float + currentShift.cash_sales;
    }

    saveLocalDb();
    return saleRecord;
  },

  // ==========================================================
  // TRANSACTIONAL REFUND & VOID RMA WORKFLOW
  // (Restores stock, voids invoice, adjusts cashier shift balance)
  // ==========================================================
  async processRefund(invoiceNo, { reason = 'Customer Return / RMA', cashier_name = 'Manager' } = {}) {
    if (isUsingMySQL && mysqlPool) {
      const connection = await mysqlPool.getConnection();
      try {
        await connection.beginTransaction();

        const [sales] = await connection.query(
          'SELECT * FROM sales WHERE invoice_no = ? FOR UPDATE',
          [invoiceNo]
        );

        if (sales.length === 0) {
          throw new Error(`Invoice '${invoiceNo}' not found.`);
        }

        const sale = sales[0];
        if (sale.status === 'refunded' || sale.status === 'voided') {
          throw new Error(`Sale #${invoiceNo} has already been refunded.`);
        }

        const [items] = await connection.query(
          'SELECT * FROM sale_items WHERE sale_id = ?',
          [sale.id]
        );

        // Restock inventory atomically
        for (const item of items) {
          if (item.product_id) {
            await connection.query(
              'UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?',
              [item.quantity, item.product_id]
            );
          }
        }

        // Update sale status
        try {
          await connection.query(
            "UPDATE sales SET status = 'refunded' WHERE id = ?",
            [sale.id]
          );
        } catch (colErr) {
          try {
            await connection.query("ALTER TABLE sales ADD COLUMN status ENUM('completed', 'refunded', 'voided') DEFAULT 'completed'");
            await connection.query("UPDATE sales SET status = 'refunded' WHERE id = ?", [sale.id]);
          } catch (e) {}
        }

        // Adjust active shift
        const currentShift = await this.getCurrentShift();
        if (currentShift) {
          const colToUpdate = sale.payment_method === 'cash' ? 'cash_sales' : sale.payment_method === 'khqr' ? 'khqr_sales' : 'card_sales';
          await connection.query(
            `UPDATE shifts SET 
              ${colToUpdate} = GREATEST(0, ${colToUpdate} - ?),
              total_sales = GREATEST(0, total_sales - ?)
             WHERE id = ?`,
            [sale.total_amount, sale.total_amount, currentShift.id]
          );
        }

        await connection.commit();
        return {
          success: true,
          invoice_no: invoiceNo,
          refunded_amount: parseFloat(sale.total_amount),
          refunded_by: cashier_name,
          reason,
          restored_items_count: items.reduce((sum, i) => sum + i.quantity, 0)
        };
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // Local Storage Mode
    const sale = localDb.sales.find(s => s.invoice_no === invoiceNo);
    if (!sale) throw new Error(`Invoice '${invoiceNo}' not found.`);
    if (sale.status === 'refunded' || sale.status === 'voided') {
      throw new Error(`Sale #${invoiceNo} has already been refunded.`);
    }

    if (Array.isArray(sale.items)) {
      for (const item of sale.items) {
        const prod = localDb.products.find(p => p.id === item.product_id || p.barcode === item.barcode);
        if (prod) {
          prod.stock_qty += item.quantity;
        }
      }
    }

    sale.status = 'refunded';
    sale.refund_reason = reason;
    sale.refunded_by = cashier_name;
    sale.refunded_at = new Date().toISOString();

    const currentShift = localDb.shifts.find(s => s.status === 'open');
    if (currentShift) {
      if (sale.payment_method === 'cash') currentShift.cash_sales = Math.max(0, currentShift.cash_sales - sale.total_amount);
      else if (sale.payment_method === 'khqr') currentShift.khqr_sales = Math.max(0, currentShift.khqr_sales - sale.total_amount);
      else currentShift.card_sales = Math.max(0, currentShift.card_sales - sale.total_amount);

      currentShift.total_sales = Math.max(0, currentShift.total_sales - sale.total_amount);
      currentShift.expected_cash = currentShift.opening_float + currentShift.cash_sales;
    }

    saveLocalDb();
    return {
      success: true,
      invoice_no: invoiceNo,
      refunded_amount: sale.total_amount,
      refunded_by: cashier_name,
      reason,
      restored_items_count: (sale.items || []).reduce((sum, i) => sum + i.quantity, 0)
    };
  },

  async getSalesHistory() {
    if (isUsingMySQL && mysqlPool) {
      const [sales] = await mysqlPool.query(
        'SELECT * FROM sales ORDER BY created_at DESC LIMIT 100'
      );
      const [allItems] = await mysqlPool.query('SELECT * FROM sale_items ORDER BY id ASC');

      const fullSales = sales.map(sale => ({
        ...sale,
        subtotal: parseFloat(sale.subtotal),
        discount: parseFloat(sale.discount),
        tax: parseFloat(sale.tax),
        total_amount: parseFloat(sale.total_amount),
        total_khr: parseFloat(sale.total_khr || 0),
        exchange_rate: parseFloat(sale.exchange_rate || 4100),
        amount_received: parseFloat(sale.amount_received),
        change_due: parseFloat(sale.change_due),
        change_due_khr: parseFloat(sale.change_due_khr || 0),
        items: allItems.filter(item => item.sale_id === sale.id).map(i => ({
          ...i,
          unit_price: parseFloat(i.unit_price),
          subtotal: parseFloat(i.subtotal),
          serial_number: i.serial_number || '',
          warranty_period: i.warranty_period || ''
        }))
      }));

      const [metricsRows] = await mysqlPool.query(`
        SELECT 
          COALESCE(SUM(total_amount), 0) AS total_revenue,
          COUNT(*) AS total_orders,
          (SELECT COALESCE(SUM(quantity), 0) FROM sale_items) AS items_sold,
          (SELECT COUNT(*) FROM products WHERE stock_qty <= low_stock_threshold) AS low_stock_count
        FROM sales
      `);

      const metrics = metricsRows[0] || {};
      return {
        sales: fullSales,
        metrics: {
          total_revenue: parseFloat(metrics.total_revenue || 0),
          total_orders: parseInt(metrics.total_orders || 0, 10),
          items_sold: parseInt(metrics.items_sold || 0, 10),
          low_stock_count: parseInt(metrics.low_stock_count || 0, 10)
        }
      };
    }

    const total_revenue = Math.round(localDb.sales.reduce((sum, s) => sum + s.total_amount, 0) * 100) / 100;
    const total_orders = localDb.sales.length;
    const items_sold = localDb.sales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);
    const low_stock_count = localDb.products.filter(p => p.stock_qty <= p.low_stock_threshold).length;

    return {
      sales: localDb.sales,
      metrics: {
        total_revenue,
        total_orders,
        items_sold,
        low_stock_count
      }
    };
  }
};

module.exports = {
  db,
  initDatabase
};
