-- =======================================================
-- Hachi Tech POS & Inventory Management System
-- Database Schema & Realistic Tech Hardware Seed Data
-- Database: MySQL 8.0+ / MariaDB 10.4+
-- =======================================================

CREATE DATABASE IF NOT EXISTS hachi_pos 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE hachi_pos;

-- 1. Products Table (Non-destructive DDL)
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barcode VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category ENUM('Peripherals', 'Components', 'Tools', 'Storage', 'Cables', 'Services') NOT NULL,
    brand VARCHAR(64) DEFAULT 'Generic',
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock_qty INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    warranty_period VARCHAR(32) DEFAULT '7 Days Return',
    requires_serial BOOLEAN DEFAULT FALSE,
    image VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_barcode (barcode),
    INDEX idx_category (category),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Shifts Table (For Shift Management & End-of-Day Z-Reports)
CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shift_no VARCHAR(32) NOT NULL UNIQUE,
    cashier_name VARCHAR(64) NOT NULL DEFAULT 'Admin',
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    status ENUM('open', 'closed') DEFAULT 'open',
    opening_float DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cash_sales DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    khqr_sales DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    card_sales DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_sales DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    expected_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    counted_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cash_difference DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    INDEX idx_shift_no (shift_no),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Sales / Invoices Table (With Dual Currency, Shift Link & RMA Status)
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(32) NOT NULL UNIQUE,
    shift_id INT NULL,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    discount DECIMAL(10, 2) DEFAULT 0.00,
    tax DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    exchange_rate DECIMAL(10, 2) DEFAULT 4100.00,
    total_khr DECIMAL(12, 2) DEFAULT 0.00,
    payment_method ENUM('cash', 'khqr', 'card') NOT NULL DEFAULT 'cash',
    status ENUM('completed', 'refunded', 'voided') NOT NULL DEFAULT 'completed',
    amount_received DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    amount_received_khr DECIMAL(12, 2) DEFAULT 0.00,
    change_due DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    change_due_khr DECIMAL(12, 2) DEFAULT 0.00,
    cashier_name VARCHAR(64) DEFAULT 'Admin',
    refund_reason VARCHAR(255) NULL,
    refunded_by VARCHAR(64) NULL,
    refunded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_invoice_no (invoice_no),
    INDEX idx_created_at (created_at),
    INDEX idx_shift_id (shift_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Sale Items (Line Items with S/N & Warranty Period)
CREATE TABLE IF NOT EXISTS sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NULL,
    barcode VARCHAR(64),
    product_name VARCHAR(150) NOT NULL,
    serial_number VARCHAR(64) NULL,
    warranty_period VARCHAR(32) DEFAULT '7 Days Return',
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_sale_items_sales FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT fk_sale_items_products FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_sale_id (sale_id),
    INDEX idx_product_id (product_id),
    INDEX idx_serial_number (serial_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =======================================================
-- Realistic Seed Data: Computer & Tech Hardware Inventory
-- =======================================================

INSERT IGNORE INTO products (barcode, name, category, brand, cost_price, selling_price, stock_qty, low_stock_threshold, warranty_period, requires_serial) VALUES
-- Peripherals
('097855171733', 'Logitech MX Master 3S Wireless Mouse (Graphite)', 'Peripherals', 'Logitech', 68.00, 99.00, 18, 5, '1 Year Warranty', TRUE),
('8886419337584', 'Razer DeathAdder V3 Ergonomic Esports Mouse', 'Peripherals', 'Razer', 45.00, 69.99, 12, 4, '2 Years Warranty', TRUE),
('4895248805218', 'Keychron K2 V2 Wireless Mechanical Keyboard (Gateron Brown)', 'Peripherals', 'Keychron', 55.00, 79.50, 15, 5, '1 Year Warranty', TRUE),
('840006638841', 'Corsair K70 RGB PRO Mechanical Gaming Keyboard (Cherry MX Red)', 'Peripherals', 'Corsair', 110.00, 159.99, 8, 3, '2 Years Warranty', TRUE),
('097855152565', 'Logitech C920s Pro HD 1080p Webcam with Privacy Shutter', 'Peripherals', 'Logitech', 44.00, 64.99, 7, 3, '1 Year Warranty', TRUE),
('6934177712345', 'SteelSeries QcK Heavy XXL Gaming Mousepad (Black)', 'Peripherals', 'SteelSeries', 14.00, 24.99, 25, 6, '7 Days Replacement', FALSE),

-- Storage
('887276707327', 'Samsung 990 PRO 1TB PCIe Gen4 NVMe M.2 SSD', 'Storage', 'Samsung', 75.00, 109.99, 22, 5, '5 Years Warranty', TRUE),
('649528929723', 'Crucial P3 Plus 2TB PCIe 4.0 3D NAND NVMe M.2 SSD', 'Storage', 'Crucial', 88.00, 124.00, 9, 4, '3 Years Warranty', TRUE),
('740617304121', 'Kingston DataTraveler Exodia 64GB USB 3.2 Flash Drive', 'Storage', 'Kingston', 3.80, 7.50, 45, 10, '5 Years Warranty', FALSE),
('760557841123', 'SanDisk Extreme PRO 128GB UHS-I SDXC Memory Card', 'Storage', 'SanDisk', 16.50, 27.99, 3, 5, 'Lifetime Limited', FALSE),
('718037887321', 'WD Blue 2TB 3.5 Inch SATA Internal Hard Drive 7200 RPM', 'Storage', 'Western Digital', 38.00, 54.00, 11, 4, '2 Years Warranty', TRUE),

-- Components
('840006623123', 'Corsair Vengeance DDR5 32GB (2x16GB) 6000MHz CL36 RAM', 'Components', 'Corsair', 72.00, 104.99, 14, 4, 'Lifetime Limited', TRUE),
('843368065432', 'Noctua NF-A12x25 PWM 120mm Premium Quiet PC Fan', 'Components', 'Noctua', 19.50, 32.90, 16, 5, '6 Years Warranty', FALSE),
('840006698765', 'Corsair RM850e Fully Modular Low-Noise ATX Power Supply 850W', 'Components', 'Corsair', 85.00, 129.99, 6, 3, '7 Years Warranty', TRUE),
('4719331812345', 'DeepCool AK620 High-Performance Dual-Tower CPU Cooler', 'Components', 'DeepCool', 42.00, 64.99, 8, 3, '3 Years Warranty', FALSE),

-- Tools & Maintenance
('856235006240', 'iFixit Pro Tech Toolkit for Precision Electronics & PCs', 'Tools', 'iFixit', 46.00, 74.99, 10, 3, 'Lifetime Warranty', FALSE),
('6934177708572', 'Xiaomi Precision 24-in-1 Magnetic Screwdriver Set', 'Tools', 'Xiaomi', 12.00, 21.50, 19, 5, '6 Months Warranty', FALSE),
('4895212701838', 'Arctic MX-4 (4g) High Performance Thermal Compound Paste', 'Tools', 'Arctic', 3.20, 7.99, 35, 8, '8 Years Durability', FALSE),
('9010018200171', 'Noctua NT-H1 3.5g Pro-Grade Thermal Grease', 'Tools', 'Noctua', 4.80, 9.99, 20, 5, '5 Years Storage', FALSE),
('079357317712', 'Falcon Dust-Off Compressed Gas Duster Can (10 oz)', 'Tools', 'Falcon', 4.00, 8.50, 2, 6, 'Consumable Item', FALSE),
('856235006999', 'Anti-Static ESD Wrist Strap with Grounding Wire Clip', 'Tools', 'Generic', 1.80, 4.99, 18, 5, '1 Year Warranty', FALSE),

-- Cables & Adapters
('194644023249', 'Anker PowerLine III USB-C to USB-C 100W Fast Charging Cable 6ft', 'Cables', 'Anker', 8.50, 15.99, 28, 6, '18 Months Warranty', FALSE),
('6957303874328', 'UGREEN 8K HDMI 2.1 Ultra High Speed Cable 2-Meter (Zinc Alloy)', 'Cables', 'UGREEN', 7.20, 13.99, 32, 6, '2 Years Warranty', FALSE),
('6957303881234', 'UGREEN Cat 8 Shielded RJ45 Gigabit Ethernet Patch Cable 3M', 'Cables', 'UGREEN', 4.50, 8.99, 24, 5, '2 Years Warranty', FALSE),
('194644055432', 'Anker 7-in-1 USB-C Hub (4K HDMI, 100W PD, SD Reader, 3x USB 3.0)', 'Cables', 'Anker', 22.00, 35.00, 11, 4, '18 Months Warranty', TRUE),
('6957303899999', 'DisplayPort 1.4 to DisplayPort Cable 2M (Supports 4K@144Hz)', 'Cables', 'UGREEN', 6.50, 12.50, 0, 5, '2 Years Warranty', FALSE),

-- Services
('SRV-CLEAN-01', 'PC Deep Dust Cleaning & Thermal Repaste Service', 'Services', 'Hachi Care', 10.00, 25.00, 999, 10, '30 Days Service Guarantee', FALSE),
('SRV-OS-02', 'Windows 11 OS Reinstallation & Data Transfer Service', 'Services', 'Hachi Care', 15.00, 35.00, 999, 10, '30 Days Support', FALSE),
('SRV-DIAG-03', 'Hardware Diagnostic & Component Testing Lab Service', 'Services', 'Hachi Care', 5.00, 15.00, 999, 10, 'N/A', FALSE),
('4712487000430', 'Crossman Long Nose Plier', 'Tools', 'Crossman', 5.00, 10.00, 9, 5, 'Lifetime Tool Warranty', FALSE);

