import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Scan, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  QrCode, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  Package,
  Sparkles,
  ShoppingBag,
  RotateCcw,
  Tag,
  ShieldCheck,
  Hash,
  Coins,
  Edit2,
  Check,
  Cpu,
  HardDrive,
  Mouse,
  Wrench,
  Cable,
  Printer,
  Zap,
  Maximize2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  formatCurrency, 
  formatKHR, 
  usdToKhr, 
  khrToUsd, 
  getStockStatus,
  DEFAULT_EXCHANGE_RATE 
} from '../utils/formatters';
import { playScanBeep, playErrorBoop, playRegisterChime } from '../utils/audio';
import { processCheckout, simulateKhqrPayment } from '../api';
import { MY_ABA_STATIC_QR, MERCHANT_INFO, generateDynamicKhqr, subscribeToPaymentEvents } from '../utils/khqr';
import BakongKhqrModal from './BakongKhqrModal';
import confetti from 'canvas-confetti';

const CATEGORIES = ['All', 'Peripherals', 'Components', 'Tools', 'Storage', 'Cables', 'Services'];

// Category Color-Accents (Glanceable Hachi Signature Polish)
const getCategoryStyle = (category) => {
  switch (category?.toLowerCase()) {
    case 'cables':
      return {
        border: 'border-t-3 border-t-sky-400 border-x border-b border-slate-200/80 hover:border-sky-400 hover:shadow-md',
        badge: 'bg-sky-50 text-sky-700 border-sky-200',
        bg: 'hover:bg-sky-50/20'
      };
    case 'components':
      return {
        border: 'border-t-3 border-t-indigo-400 border-x border-b border-slate-200/80 hover:border-indigo-400 hover:shadow-md',
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        bg: 'hover:bg-indigo-50/20'
      };
    case 'peripherals':
      return {
        border: 'border-t-3 border-t-violet-400 border-x border-b border-slate-200/80 hover:border-violet-400 hover:shadow-md',
        badge: 'bg-violet-50 text-violet-700 border-violet-200',
        bg: 'hover:bg-violet-50/20'
      };
    case 'storage':
      return {
        border: 'border-t-3 border-t-amber-400 border-x border-b border-slate-200/80 hover:border-amber-400 hover:shadow-md',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        bg: 'hover:bg-amber-50/20'
      };
    case 'tools':
      return {
        border: 'border-t-3 border-t-emerald-400 border-x border-b border-slate-200/80 hover:border-emerald-400 hover:shadow-md',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        bg: 'hover:bg-emerald-50/20'
      };
    case 'services':
      return {
        border: 'border-t-3 border-t-rose-400 border-x border-b border-slate-200/80 hover:border-rose-400 hover:shadow-md',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        bg: 'hover:bg-rose-50/20'
      };
    default:
      return {
        border: 'border-t-3 border-t-sky-400 border-x border-b border-slate-200/80 hover:border-sky-400 hover:shadow-md',
        badge: 'bg-sky-50 text-sky-700 border-sky-200',
        bg: 'hover:bg-sky-50/20'
      };
  }
};

// Category icon mapper for visual image placeholder
const getProductCategoryIcon = (category) => {
  switch (category) {
    case 'Peripherals': return Mouse;
    case 'Components': return Cpu;
    case 'Tools': return Wrench;
    case 'Storage': return HardDrive;
    case 'Cables': return Cable;
    default: return Package;
  }
};

export default function PosTerminal({ 
  products = [], 
  onRefreshProducts, 
  onCheckoutSuccess,
  currentShift = null,
  cashierName = 'Alex S.'
}) {
  // Catalog State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Cart State (Persisted across refreshes and tab switches)
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('hachi_pos_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync cart changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('hachi_pos_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Failed to save cart to localStorage', e);
    }
  }, [cart]);
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percent'
  const [discountValue, setDiscountValue] = useState('');
  const [taxPercent, setTaxPercent] = useState(0); // 0% or 10%
  
  // Dual Currency State
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(DEFAULT_EXCHANGE_RATE.toString());

  // Tender State
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'khqr' | 'card'
  const [amountReceived, setAmountReceived] = useState('');
  const [amountReceivedKhr, setAmountReceivedKhr] = useState('');
  const [khqrCurrency, setKhqrCurrency] = useState('USD'); // 'USD' | 'KHR'
  const [khqrModalOpen, setKhqrModalOpen] = useState(false);
  const [khqrQrMode, setKhqrQrMode] = useState('dynamic'); // 'dynamic' | 'static'
  const [khqrSessionTime, setKhqrSessionTime] = useState(Date.now());
  const [khqrBillNo, setKhqrBillNo] = useState(() => 'INV-' + Date.now().toString().slice(-6));

  // Reset or refresh bill & timestamp when cart changes
  useEffect(() => {
    setKhqrSessionTime(Date.now());
    setKhqrBillNo('INV-' + Date.now().toString().slice(-6));
  }, [cart.length]);
  
  // Serial Number Editing State
  const [editingSnId, setEditingSnId] = useState(null);
  const [snInput, setSnInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [scanNotification, setScanNotification] = useState(null);
  const [highlightedProductId, setHighlightedProductId] = useState(null);
  const [justAddedId, setJustAddedId] = useState(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Dedicated Quick Scan Barcode Input
  const [quickScanInput, setQuickScanInput] = useState('');
  const quickScanRef = useRef(null);

  // Buffer references for Global Hands-Free Keyboard Wedge Barcode Scanner
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const lastScanTimeRef = useRef(0);
  const lastScanCodeRef = useRef('');

  // Auto-focus barcode scanner input on mount
  useEffect(() => {
    quickScanRef.current?.focus();
  }, []);

  // ==========================================================
  // Always-Ready Hands-Free USB Barcode Scanner & Retail Hotkeys
  // Automatically captures scans when idle & provides power-user shortcuts
  // ==========================================================
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT'
      );
      const isQuickScanActive = activeEl === quickScanRef.current;

      // Retail Speed Shortcuts (Only when cashier is NOT typing in an input)
      if (!isInput) {
        // [Enter] inside Confirm Modal triggers immediate checkout
        if (e.key === 'Enter' && confirmModalOpen && cart.length > 0 && !isSubmitting) {
          e.preventDefault();
          setConfirmModalOpen(false);
          executeCheckout();
          return;
        }

        // [Space] or [F1]: Prompt Checkout Confirmation
        if ((e.code === 'Space' || e.key === 'F1') && cart.length > 0 && !isSubmitting) {
          e.preventDefault();
          if (paymentMethod === 'khqr') {
            setKhqrModalOpen(true);
          } else {
            setConfirmModalOpen(true);
          }
          return;
        }

        // [F2]: Open Bakong KHQR Modal
        if (e.key === 'F2' && cart.length > 0) {
          e.preventDefault();
          setPaymentMethod('khqr');
          setKhqrModalOpen(true);
          return;
        }

        // [F4]: Reset / Clear Cart
        if (e.key === 'F4' && cart.length > 0) {
          e.preventDefault();
          clearCart();
          return;
        }

        // [/]: Quick-Focus Search Bar
        if (e.key === '/') {
          e.preventDefault();
          const searchInput = document.querySelector('input[name="search-catalog"]');
          searchInput?.focus();
          searchInput?.select();
          return;
        }

        // [Escape]: Close Modals or Clear Search
        if (e.key === 'Escape') {
          setKhqrModalOpen(false);
          setConfirmModalOpen(false);
          setEditingSnId(null);
          setCheckoutError('');
          return;
        }
      }

      // CRITICAL: If cashier is typing inside ANY input (Discount, Paid USD/KHR, Search, S/N, Modal, etc.)
      // NEVER steal focus to the barcode scanner!
      if (isInput && !isQuickScanActive) {
        // If Enter is pressed inside the search-catalog input, allow adding item by barcode
        if (e.key === 'Enter' && activeEl.getAttribute('name') === 'search-catalog') {
          const query = searchQuery.trim();
          if (query.length >= 3) {
            e.preventDefault();
            handleScannedBarcode(query);
          }
        }
        return;
      }

      // If user is completely outside any input (e.g. clicked product card, background, or button)
      // and presses a printable alphanumeric character, auto-focus scanner input for USB wedge scanner
      if (!isInput && e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.code !== 'Space') {
        quickScanRef.current?.focus();
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Reset buffer if delay between characters is too long (> 250ms)
      if (timeDiff > 250) {
        barcodeBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const codeFromInput = isQuickScanActive ? quickScanInput : '';
        const scannedCode = (codeFromInput || barcodeBufferRef.current).trim();

        if (scannedCode.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          handleScannedBarcode(scannedCode);
        }

        barcodeBufferRef.current = '';
        return;
      }

      // Collect alphanumeric characters into the global scanner buffer
      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.code !== 'Space') {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [products, quickScanInput, searchQuery, editingSnId, cart, isSubmitting, paymentMethod]);

  // Handle scanned or entered barcode with duplicate debounce
  const handleScannedBarcode = (code) => {
    const cleanCode = (code || '').trim();
    if (!cleanCode) return;

    // DEBOUNCE: Protect against scanners sending CR + LF (double Enter in < 400ms)
    const now = Date.now();
    if (cleanCode === lastScanCodeRef.current && (now - lastScanTimeRef.current) < 400) {
      return;
    }
    lastScanTimeRef.current = now;
    lastScanCodeRef.current = cleanCode;

    // Lookup in loaded products by exact barcode or matching SKU
    const product = products.find(p => 
      p.barcode === cleanCode || 
      p.barcode.toLowerCase() === cleanCode.toLowerCase()
    );

    if (product) {
      // 1. Sync catalog search and category so the product card IMMEDIATELY shows up on screen!
      setSearchQuery(product.barcode);
      setSelectedCategory('All');
      setHighlightedProductId(product.id);
      setTimeout(() => setHighlightedProductId(null), 3000);

      // 2. Stock check
      if (product.stock_qty <= 0) {
        playErrorBoop();
        triggerNotification(`"${product.name}" is OUT OF STOCK!`, 'error');
        setQuickScanInput('');
        setTimeout(() => quickScanRef.current?.focus(), 20);
        return;
      }

      // 3. Cart stock limit check
      const existingInCart = cart.find(item => item.id === product.id);
      const currentQty = existingInCart ? existingInCart.quantity : 0;

      if (currentQty >= product.stock_qty) {
        playErrorBoop();
        triggerNotification(`Cannot add more. Available stock limit (${product.stock_qty}) reached.`, 'warning');
        setQuickScanInput('');
        setTimeout(() => quickScanRef.current?.focus(), 20);
        return;
      }

      // 4. Add to cart & play scanner beep (Single increment guaranteed)
      playScanBeep();
      addToCart(product);
      triggerNotification(`✓ Added to Cart: ${product.name}`, 'success');
      setQuickScanInput('');
      setTimeout(() => quickScanRef.current?.focus(), 20);
    } else {
      playErrorBoop();
      triggerNotification(`Barcode '${cleanCode}' not found in inventory.`, 'error');
      setQuickScanInput('');
      setTimeout(() => quickScanRef.current?.focus(), 20);
    }
  };

  const triggerNotification = (message, type = 'info') => {
    setScanNotification({ message, type });
    setTimeout(() => {
      setScanNotification(null);
    }, 3200);
  };

  // Pure Immutable Cart Management (Includes Warranty & Serial Support)
  const addToCart = (product) => {
    if (product.stock_qty <= 0) {
      playErrorBoop();
      triggerNotification(`${product.name} is out of stock!`, 'error');
      return;
    }

    // Trigger instant visual add-to-cart confirmation animation
    setJustAddedId(product.id);
    setTimeout(() => {
      setJustAddedId(prev => (prev === product.id ? null : prev));
    }, 850);

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_qty) {
          return prev;
        }
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        unit_price: parseFloat(product.selling_price),
        stock_qty: product.stock_qty,
        warranty_period: product.warranty_period || '7 Days Return',
        requires_serial: Boolean(product.requires_serial),
        serial_number: '',
        quantity: 1
      }];
    });
  };

  const updateCartQty = (productId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.stock_qty) {
            playErrorBoop();
            triggerNotification(`Max available stock limit (${item.stock_qty}) reached.`, 'warning');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateItemSerialNumber = (productId, sn) => {
    setCart(prev => prev.map(item => item.id === productId ? { ...item, serial_number: sn.trim() } : item));
    setEditingSnId(null);
    setSnInput('');
    playScanBeep();
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue('');
    setAmountReceived('');
    setAmountReceivedKhr('');
    setCheckoutError('');
  };

  // Financial Calculations (Dual Currency USD & KHR)
  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  
  const discountAmount = discountType === 'percent'
    ? (subtotal * (parseFloat(discountValue) || 0)) / 100
    : parseFloat(discountValue) || 0;
    
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = (discountedSubtotal * (parseFloat(taxPercent) || 0)) / 100;
  const grandTotal = Math.max(0, discountedSubtotal + taxAmount);
  const grandTotalKhr = Math.round(grandTotal * exchangeRate);

  // Cash Received USD & KHR combined
  const numReceivedUsd = parseFloat(amountReceived) || 0;
  const numReceivedKhr = parseFloat(amountReceivedKhr) || 0;
  const totalPaidInUsd = numReceivedUsd + (numReceivedKhr / exchangeRate);
  
  const changeDueUsd = Math.max(0, totalPaidInUsd - grandTotal);
  const changeDueKhr = Math.round(changeDueUsd * exchangeRate);
  const isSufficientAmount = paymentMethod !== 'cash' || totalPaidInUsd >= (grandTotal - 0.005);

  // Filter Catalog
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(q) || 
      p.barcode.toLowerCase().includes(q) || 
      (p.brand && p.brand.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // Handle Complete Sale & ACID Checkout
  const executeCheckout = async (forcedMethod = null) => {
    if (cart.length === 0 || isSubmitting) return;
    setCheckoutError('');

    const effectiveMethod = (typeof forcedMethod === 'string' && forcedMethod) ? forcedMethod : paymentMethod;

    if (effectiveMethod === 'cash' && !isSufficientAmount) {
      playErrorBoop();
      setCheckoutError(`Cash received ($${totalPaidInUsd.toFixed(2)}) is less than Grand Total ($${grandTotal.toFixed(2)} / ${grandTotalKhr.toLocaleString()} ៛).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload = {
        shift_id: currentShift?.id || null,
        cart: cart.map(i => ({
          id: i.id,
          barcode: i.barcode,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          serial_number: i.serial_number || '',
          warranty_period: i.warranty_period || '7 Days Return'
        })),
        payment_method: effectiveMethod,
        amount_received: effectiveMethod === 'cash' ? totalPaidInUsd : grandTotal,
        amount_received_khr: effectiveMethod === 'cash' ? numReceivedKhr : grandTotalKhr,
        exchange_rate: exchangeRate,
        discount: discountAmount,
        tax: taxAmount,
        cashier_name: cashierName
      };

      const result = await processCheckout(orderPayload);

      playRegisterChime();
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch (e) {}

      onCheckoutSuccess(result.data.receipt, result.data.escpos, autoPrintEnabled);
      clearCart();
      if (onRefreshProducts) onRefreshProducts();
    } catch (err) {
      playErrorBoop();
      setCheckoutError(err.response?.data?.message || err.message || 'Checkout failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe Checkout Prompt
  const handleCheckout = (forcedMethod = null) => {
    if (cart.length === 0 || isSubmitting) return;
    const effectiveMethod = (typeof forcedMethod === 'string' && forcedMethod) ? forcedMethod : paymentMethod;
    if (effectiveMethod === 'khqr') {
      setKhqrModalOpen(true);
      return;
    }
    // Check cash sufficiency before opening confirm modal
    if (effectiveMethod === 'cash' && !isSufficientAmount) {
      playErrorBoop();
      setCheckoutError(`Cash received ($${totalPaidInUsd.toFixed(2)}) is less than Grand Total ($${grandTotal.toFixed(2)} / ${grandTotalKhr.toLocaleString()} ៛).`);
      return;
    }
    setConfirmModalOpen(true);
  };

  // ==========================================================
  // Real-Time Payment Event Listener (ABA & Bakong KHQR Network)
  // Automatically detects incoming payments via SSE & WebSocket
  // ==========================================================
  useEffect(() => {
    const unsubscribe = subscribeToPaymentEvents((data) => {
      
      // Auto-trigger sale completion when payment arrives!
      if (cart.length > 0 && !isSubmitting) {
        playRegisterChime();
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (e) {}

        const confirmedAmtStr = data.currency === 'KHR' 
          ? formatKHR(data.amount || grandTotalKhr) 
          : formatCurrency(data.amount || grandTotal);

        triggerNotification(`⚡ Payment Verified via ABA Bank (${confirmedAmtStr})! Processing sale...`, 'success');

        setKhqrModalOpen(false);

        // Auto-finalize checkout ACID transaction with KHQR payment method
        setPaymentMethod('khqr');
        handleCheckout('khqr');
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [cart, grandTotal, grandTotalKhr, exchangeRate, autoPrintEnabled, isSubmitting, totalPaidInUsd, numReceivedKhr, isSufficientAmount]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2.5 gap-2.5 bg-sky-50 min-h-0">
      
      {/* Toast Notification with Soft Hachi Theme */}
      {scanNotification && (
        <div className={`fixed bottom-10 right-5 z-50 px-3.5 py-2 rounded-2xl shadow-lg border text-xs font-semibold flex items-center space-x-2 animate-bounce ${
          scanNotification.type === 'success' 
            ? 'bg-sky-500 text-white border-sky-600 shadow-sky-500/30' 
            : scanNotification.type === 'error'
            ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/30' 
            : 'bg-amber-500 text-white border-amber-600 shadow-amber-500/30'
        }`}>
          <Scan className="w-3.5 h-3.5" />
          <span>{scanNotification.message}</span>
        </div>
      )}

      {/* ========================================================
          LEFT SIDE: PRODUCTS CATALOG & SCANNER
          ======================================================== */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* Top Action Bar: Unified Search & Barcode Omni-Bar */}
        <div className="bg-white p-2.5 rounded-3xl border border-sky-100 shadow-xs space-y-2 shrink-0 mb-2.5">
          
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              ref={quickScanRef}
              name="search-catalog"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  e.preventDefault();
                  handleScannedBarcode(searchQuery.trim());
                }
              }}
              placeholder="Search product name, brand, or scan barcode with USB scanner... [/]"
              className="w-full bg-slate-50/70 border border-slate-200 focus:border-sky-400 focus:bg-white rounded-2xl pl-10 pr-28 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-2xs"
            />
            
            <div className="absolute right-2 top-1.5 flex items-center space-x-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (searchQuery.trim()) {
                    handleScannedBarcode(searchQuery.trim());
                  }
                }}
                className="px-3 py-1 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1 cursor-pointer shadow-xs"
                title="Scan or press Enter to add item directly"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Scan / Enter</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills & Exchange Rate Widget */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 pt-0.5 scrollbar-none">
            <div className="flex items-center space-x-1.5">
              {CATEGORIES.map(category => {
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-400 text-white shadow-xs font-bold'
                        : 'bg-white text-slate-600 hover:bg-sky-50 hover:text-sky-700 border border-sky-100'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>

            {/* Dual Currency Exchange Rate Pill (Hachi Blush Accent) */}
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold flex-shrink-0">
              <Coins className="w-3.5 h-3.5 text-rose-400" />
              {isEditingRate ? (
                <div className="flex items-center space-x-1">
                  <span>$1 =</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tempRate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*$/.test(val)) {
                        setTempRate(val);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-16 bg-white border border-rose-300 rounded-lg px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-800 focus:outline-none focus:border-rose-500 shadow-2xs"
                  />
                  <span>KHR</span>
                  <button
                    onClick={() => {
                      const cleanRate = Math.max(100, parseFloat(tempRate) || 4100);
                      setExchangeRate(cleanRate);
                      setTempRate(cleanRate.toString());
                      setIsEditingRate(false);
                    }}
                    className="p-0.5 text-sky-600 hover:bg-sky-100 rounded-md cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingRate(true)}
                  className="hover:underline flex items-center space-x-1 cursor-pointer"
                  title="Click to edit USD/KHR exchange rate"
                >
                  <span>$1 = {exchangeRate.toLocaleString()} ៛</span>
                  <Edit2 className="w-3 h-3 text-rose-400 ml-0.5 opacity-70" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Product Cards Catalog Grid (Glanceable 2.5ft Visual Touch Targets) */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-0">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-sky-200 p-6 text-center">
              <Package className="w-12 h-12 text-sky-200 mb-2" />
              <p className="text-base font-bold text-slate-700">No hardware items found</p>
              <p className="text-xs text-slate-400 mt-1">Try tweaking your search keywords or switch category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 pb-8">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock_qty <= 0;
                const inCartItem = cart.find(i => i.id === product.id);
                const inCartQty = inCartItem ? inCartItem.quantity : 0;
                const isJustAdded = justAddedId === product.id;
                const catStyle = getCategoryStyle(product.category);
                const isLowStock = product.stock_qty <= (product.low_stock_threshold || 3) && product.stock_qty > 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    className={`group relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-150 flex flex-col p-3.5 cursor-pointer hover:bg-sky-50/60 active:scale-95 select-none min-h-[145px] justify-between ${catStyle.border} ${catStyle.bg} ${
                      isJustAdded
                        ? 'ring-4 ring-sky-400 bg-sky-50 scale-[1.02] shadow-lg'
                        : highlightedProductId === product.id
                        ? 'ring-4 ring-sky-300 bg-sky-50 scale-[1.02] shadow-lg'
                        : isOutOfStock
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-300 pointer-events-none'
                        : ''
                    }`}
                  >
                    {/* Visual 1-second overlay checkmark confirmation */}
                    {isJustAdded && (
                      <div className="absolute inset-0 bg-sky-500/20 backdrop-blur-[0.5px] rounded-2xl flex items-center justify-center z-30 pointer-events-none animate-in fade-in zoom-in duration-100">
                        <span className="px-4 py-2 rounded-full bg-sky-500 text-white font-black text-sm shadow-xl flex items-center space-x-2 animate-bounce">
                          <Check className="w-5 h-5 stroke-[3]" />
                          <span>ADDED!</span>
                        </span>
                      </div>
                    )}

                    {/* OUT OF STOCK Stamp Overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        <div className="border-4 border-rose-500 text-rose-600 font-black text-2xl uppercase tracking-widest px-6 py-1 rounded-2xl bg-white/95 shadow-xl -rotate-12">
                          OUT
                        </div>
                      </div>
                    )}

                    {/* Top Meta: Brand Pill & In-Cart Count */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center space-x-1.5 overflow-hidden">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider shrink-0 border border-slate-200/60">
                          {product.brand || product.category}
                        </span>
                        {isLowStock && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[9px] flex items-center space-x-0.5 shrink-0 border border-amber-200">
                            <span>⚠️ {product.stock_qty} left</span>
                          </span>
                        )}
                      </div>
                      {inCartQty > 0 && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-sky-500 text-white font-black text-xs font-mono shadow-xs">
                          ×{inCartQty}
                        </span>
                      )}
                    </div>

                    {/* Center: Thumbnail + Title */}
                    <div className="flex items-start space-x-2.5 my-1">
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <Package className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-sky-600 transition-colors">
                        {product.name}
                      </h4>
                    </div>

                    {/* Bottom: Price + KHR Dual-Currency Pill */}
                    <div className="mt-auto pt-2 flex items-baseline justify-between border-t border-slate-100">
                      <span className="text-sky-600 text-lg font-black font-mono">
                        {formatCurrency(product.selling_price)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold font-mono">
                        {formatKHR(parseFloat(product.selling_price) * exchangeRate)}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ========================================================
          RIGHT SIDE: CASHIER CART & CHECKOUT SIDEBAR (Responsive w-full lg:w-[380px] xl:w-[420px] 2xl:w-[460px])
          ======================================================== */}
      <div className="w-full lg:w-[380px] xl:w-[420px] 2xl:w-[460px] flex flex-col h-[480px] lg:h-full bg-white rounded-3xl lg:rounded-none border border-sky-100 lg:border-l lg:border-t-0 lg:border-r-0 lg:border-b-0 overflow-hidden shrink-0 shadow-xs">
        
        {/* Top Header: shrink-0 p-3 */}
        <div className="shrink-0 p-3 bg-white border-b border-sky-100 flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-sky-300 bg-white shadow-2xs flex items-center justify-center shrink-0">
              <img src="/hachi.jpg" alt="Hachi" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 leading-tight">Cashier Cart</h3>
              <p className="text-[11px] text-slate-400 leading-none">Active customer basket</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 text-xs font-black font-mono">
              {cart.reduce((s, i) => s + i.quantity, 0)} items
            </span>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold flex items-center space-x-1 transition-colors px-2 py-0.5 rounded-lg cursor-pointer"
                title="Reset Cart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Cart Items Area: flex-1 overflow-y-auto p-3 (stretches and shrinks freely) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
          {cart.length === 0 ? null : (
            cart.map(item => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-white border border-sky-100 shadow-2xs flex items-center justify-between gap-2"
              >
                {/* Item Name */}
                <div className="flex-1 min-w-0 pr-2">
                  <h5 className="text-sm font-bold text-slate-800 truncate" title={item.name}>
                    {item.name}
                  </h5>
                  <span className="text-xs font-semibold text-slate-400 font-mono">
                    {formatCurrency(item.unit_price)} each
                  </span>
                </div>

                {/* Quantity Controls & Red Trash Void */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateCartQty(item.id, -1)}
                    className="w-7 h-7 rounded-lg bg-sky-100 hover:bg-sky-200 active:scale-95 text-sky-800 flex items-center justify-center font-black text-sm transition-all cursor-pointer"
                    title="Decrease quantity"
                  >
                    <Minus className="w-3 h-3 stroke-[3]" />
                  </button>

                  <span className="w-5 text-center font-black text-sm text-slate-900 font-mono">
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => updateCartQty(item.id, 1)}
                    className="w-7 h-7 rounded-lg bg-sky-400 hover:bg-sky-500 active:scale-95 text-white flex items-center justify-center font-black text-sm transition-all cursor-pointer shadow-2xs"
                    title="Increase quantity"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                  </button>

                  {/* Price */}
                  <div className="w-16 text-right font-black text-xs text-sky-600 font-mono ml-1">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </div>

                  {/* Small Red Trash Button for Instant Voids */}
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-200 transition-all flex items-center justify-center cursor-pointer shadow-2xs ml-0.5 active:scale-95 shrink-0"
                    title="Void / Remove Item"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ruthless Consolidation of the Payment Block: shrink-0 flex flex-col bg-sky-50/50 p-3 border-t border-sky-100 space-y-2 */}
        <div id="cart-tender-area" className="shrink-0 flex flex-col bg-sky-50/50 p-3 border-t border-sky-100 space-y-2">
          
          {/* Row 1 (Sub/Disc/Tax): Inline, text-xs */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-1 font-semibold text-slate-600">
              <span className="text-[11px]">Subtotal:</span>
              <span className="font-mono text-slate-900 font-black text-xs">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              {/* Discount Selector: $ / % toggle + Easy direct-type input */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 text-[10px] font-bold">Disc:</span>
                <div className="flex items-center bg-sky-100 p-0.5 rounded-lg border border-sky-200">
                  <button
                    type="button"
                    onClick={() => setDiscountType('amount')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                      discountType === 'amount'
                        ? 'bg-white text-sky-700 shadow-2xs'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Discount in Dollars ($)"
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                      discountType === 'percent'
                        ? 'bg-white text-sky-700 shadow-2xs'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Discount in Percentage (%)"
                  >
                    %
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="discount-input"
                    name="discount-input"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={discountValue}
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '.');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setDiscountValue(val);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-14 h-6 bg-white border border-sky-200 text-slate-900 font-mono text-xs font-bold rounded-lg px-1.5 text-right focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200 shadow-2xs"
                  />
                  {discountValue !== '' && discountValue !== 0 && (
                    <button
                      type="button"
                      onClick={() => setDiscountValue('')}
                      className="ml-0.5 text-slate-400 hover:text-rose-500 text-xs font-bold cursor-pointer"
                      title="Clear discount"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Tax Selector: 0% / 10% 1-tap buttons */}
              <div className="flex items-center space-x-1 pl-1">
                <span className="text-slate-500 text-[10px] font-bold">Tax:</span>
                <div className="flex items-center bg-sky-100 p-0.5 rounded-lg border border-sky-200">
                  <button
                    type="button"
                    onClick={() => setTaxPercent(0)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                      taxPercent === 0
                        ? 'bg-white text-sky-700 shadow-2xs'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Tax-Free (0%)"
                  >
                    0%
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxPercent(10)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                      taxPercent === 10
                        ? 'bg-white text-sky-700 shadow-2xs'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Standard VAT (10%)"
                  >
                    10%
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 (Grand Total): Tight container, text-3xl */}
          <div className="flex items-baseline justify-between border-t border-sky-200/60 pt-1">
            <div>
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Grand Total</span>
              <span className="text-[10px] font-bold text-sky-600 font-mono">
                1 USD = {exchangeRate.toLocaleString()} ៛
              </span>
            </div>
            <div className="text-right">
              <div className="flex items-baseline justify-end space-x-1.5">
                <span className="text-3xl font-black text-sky-600 font-mono tracking-tight leading-none">
                  {formatCurrency(grandTotal)}
                </span>
                <span className="text-xs font-bold text-rose-500 font-mono">
                  ({formatKHR(grandTotalKhr)})
                </span>
              </div>
            </div>
          </div>

          {/* Row 3 (Payment Tabs): h-9 buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'cash', label: 'Cash (USD/៛)', icon: Banknote },
              { id: 'khqr', label: 'KHQR (Bakong)', icon: QrCode, hotkey: 'F2' },
              { id: 'card', label: 'Card', icon: CreditCard }
            ].map(method => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method.id);
                    if (method.id !== 'cash') {
                      setAmountReceived(grandTotal.toFixed(2));
                      setAmountReceivedKhr('');
                    }
                  }}
                  className={`h-9 px-2 rounded-xl border flex items-center justify-center space-x-1.5 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-sky-100 border-sky-400 text-sky-800 font-black shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-sky-50 font-bold'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-black truncate">{method.label}</span>
                  {method.hotkey && (
                    <span className="hidden sm:inline-block px-1 py-0.2 rounded bg-slate-100 text-[9px] font-mono font-bold text-slate-400 border border-slate-200">
                      {method.hotkey}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Conditional Tender Section: Only rendered if Payment Method is 'cash' */}
          {paymentMethod === 'cash' ? (
            <>
              {/* Row 4: USD Quick Cash (h-8 text-xs) */}
              <div className="grid grid-cols-5 gap-1.5">
                {[10, 20, 50, 100].map(val => (
                  <button
                    key={`usd-${val}`}
                    type="button"
                    onClick={() => {
                      setAmountReceived(val.toFixed(2));
                      setAmountReceivedKhr('');
                    }}
                    className={`h-8 rounded-xl border font-mono text-xs font-black transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center justify-center ${
                      parseFloat(amountReceived) === val && !amountReceivedKhr
                        ? 'bg-sky-500 text-white border-sky-600 ring-1 ring-sky-300'
                        : 'bg-white hover:bg-sky-100 text-sky-800 border-sky-200'
                    }`}
                  >
                    ${val}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setAmountReceived(grandTotal.toFixed(2));
                    setAmountReceivedKhr('');
                  }}
                  className="h-8 rounded-xl border bg-sky-500 hover:bg-sky-600 text-white font-mono text-[11px] font-black transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center justify-center"
                  title="Exact USD"
                >
                  Exact $
                </button>
              </div>

              {/* Row 5: KHR Quick Cash (h-8 text-xs) */}
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { label: '20k ៛', val: 20000 },
                  { label: '50k ៛', val: 50000 },
                  { label: '100k ៛', val: 100000 },
                  { label: '200k ៛', val: 200000 }
                ].map(bill => (
                  <button
                    key={`khr-${bill.val}`}
                    type="button"
                    onClick={() => {
                      setAmountReceived('');
                      setAmountReceivedKhr(bill.val.toString());
                    }}
                    className={`h-8 rounded-xl border font-mono text-[11px] font-black transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center justify-center ${
                      parseFloat(amountReceivedKhr) === bill.val && !amountReceived
                        ? 'bg-rose-500 text-white border-rose-600 ring-1 ring-rose-300'
                        : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {bill.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setAmountReceived('');
                    setAmountReceivedKhr(Math.round(grandTotalKhr).toString());
                  }}
                  className="h-8 rounded-xl border bg-rose-500 hover:bg-rose-600 text-white font-mono text-[11px] font-black transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center justify-center"
                  title="Exact KHR"
                >
                  Exact ៛
                </button>
              </div>

              {/* Row 6: Manual Inputs (grid grid-cols-2 gap-2, h-10, embedded placeholder label, no arrow steppers) */}
              <div className="grid grid-cols-2 gap-2">
                {/* USD Manual */}
                <div className="h-10 bg-white border border-sky-200 rounded-xl px-2.5 flex items-center focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-200 shadow-2xs">
                  <span className="text-sky-500 font-mono text-sm font-bold mr-1.5">$</span>
                  <input
                    id="usd-cash-input"
                    type="text"
                    inputMode="decimal"
                    value={amountReceived}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setAmountReceived(val);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="Paid ($ USD)"
                    className="w-full bg-transparent font-mono text-sm font-black text-slate-800 focus:outline-none placeholder:text-slate-400 placeholder:font-sans placeholder:text-xs"
                  />
                  {amountReceived !== '' && (
                    <button
                      type="button"
                      onClick={() => setAmountReceived('')}
                      className="text-slate-400 hover:text-slate-700 text-xs font-bold px-1 cursor-pointer"
                      title="Clear USD"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* KHR Manual (Hachi Blush Rose Accent) */}
                <div className="h-10 bg-white border border-rose-200 rounded-xl px-2.5 flex items-center focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-200 shadow-2xs">
                  <span className="text-rose-500 font-mono text-sm font-bold mr-1.5">៛</span>
                  <input
                    id="khr-cash-input"
                    type="text"
                    inputMode="numeric"
                    value={amountReceivedKhr}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*$/.test(val)) {
                        setAmountReceivedKhr(val);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="Paid (៛ KHR)"
                    className="w-full bg-transparent font-mono text-sm font-black text-rose-600 focus:outline-none placeholder:text-rose-300 placeholder:font-sans placeholder:text-xs"
                  />
                  {amountReceivedKhr !== '' && (
                    <button
                      type="button"
                      onClick={() => setAmountReceivedKhr('')}
                      className="text-rose-400 hover:text-rose-700 text-xs font-bold px-1 cursor-pointer"
                      title="Clear KHR"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Row 7: Change Due & Auto-Print MERGED */}
              <div className="flex justify-between items-center px-1 text-xs">
                <div className="flex items-baseline space-x-1.5">
                  <span className="font-bold text-slate-600 text-xs uppercase tracking-wider">Change Due:</span>
                  <span className="font-mono font-black text-base text-sky-600 leading-none">
                    {formatCurrency(changeDueUsd)}
                  </span>
                  <span className="font-mono font-bold text-[11px] text-rose-500">
                    ({formatKHR(changeDueKhr)})
                  </span>
                </div>

                <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoPrintEnabled}
                    onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-sky-500 focus:ring-sky-400 border-sky-300 cursor-pointer"
                  />
                  <Printer className="w-3 h-3 text-sky-500" />
                  <span className="text-[11px]">Auto-Print</span>
                </label>
              </div>
            </>
          ) : paymentMethod === 'khqr' ? (
            (() => {
              const activeKhqrAmount = khqrCurrency === 'USD' ? grandTotal : grandTotalKhr;
              const currentKhqrString = khqrQrMode === 'static' 
                ? MY_ABA_STATIC_QR 
                : generateDynamicKhqr({ 
                    amount: activeKhqrAmount, 
                    currency: khqrCurrency, 
                    billNo: khqrBillNo,
                    validityMinutes: 15,
                    timestamp: khqrSessionTime
                  });

              return (
                <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="bg-[#E21A1A] text-white font-black text-[9px] px-1 py-0.2 rounded tracking-wider">KHQR</span>
                      <span className="font-extrabold text-xs text-slate-800">David Sarary • ABA</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="flex items-center space-x-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Live Radar</span>
                      </div>
                      <div className="flex items-center space-x-0.5 bg-slate-100 p-0.5 rounded text-[11px]">
                        <button
                          type="button"
                          onClick={() => setKhqrCurrency('USD')}
                          className={`px-1.5 py-0.5 rounded font-black cursor-pointer ${khqrCurrency === 'USD' ? 'bg-sky-600 text-white' : 'text-slate-600'}`}
                        >
                          USD
                        </button>
                        <button
                          type="button"
                          onClick={() => setKhqrCurrency('KHR')}
                          className={`px-1.5 py-0.5 rounded font-black cursor-pointer ${khqrCurrency === 'KHR' ? 'bg-sky-600 text-white' : 'text-slate-600'}`}
                        >
                          KHR
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Scannable Real QR Image and Details */}
                  <div className="flex items-center space-x-2.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setKhqrModalOpen(true)}
                      className="w-14 h-14 bg-white border-2 border-slate-900 rounded-lg p-0.5 shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-sky-500 transition-all shadow-xs relative group"
                      title="Click to enlarge for customer scanning"
                    >
                      <QRCodeSVG
                        value={currentKhqrString}
                        size={48}
                        level="M"
                      />
                      <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                        <Maximize2 className="w-3.5 h-3.5 text-slate-800" />
                      </div>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-base font-black text-slate-900 font-mono leading-none">
                          {khqrCurrency === 'USD' ? formatCurrency(grandTotal) : formatKHR(grandTotalKhr)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setKhqrModalOpen(true)}
                          className="text-[10px] font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center space-x-0.5 cursor-pointer"
                        >
                          <span>Enlarge</span>
                          <Maximize2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <button
                          type="button"
                          onClick={() => handleCheckout('khqr')}
                          className="px-2.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded flex items-center space-x-1 cursor-pointer transition-all shadow-2xs active:scale-95"
                          title="Click to confirm customer payment received"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>✓ Confirm Paid</span>
                        </button>
                        <span className="text-[10px] font-medium text-slate-400">
                          Official Dynamic KHQR
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="p-2.5 rounded-xl bg-white border border-sky-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <CreditCard className="w-6 h-6 text-sky-500 shrink-0" />
                <div>
                  <span className="font-black text-slate-800 text-xs block leading-tight">Credit / Debit Terminal</span>
                  <span className="text-slate-400 text-[10px]">Swipe, chip, or tap NFC</span>
                </div>
              </div>
              <label className="flex items-center space-x-1 text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoPrintEnabled}
                  onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                  className="w-3 h-3 rounded text-sky-500 border-sky-300 cursor-pointer"
                />
                <Printer className="w-3 h-3 text-sky-500" />
                <span>Auto-Print</span>
              </label>
            </div>
          )}

          {/* Row 7.5: Zero-Shift Status & Error Strip (Fixed min-height to prevent jumping) */}
          <div className="min-h-[26px] flex items-center justify-between text-xs px-1">
            {checkoutError ? (
              <div className="w-full p-1.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-700 font-bold flex items-center space-x-1.5 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span className="truncate">{checkoutError}</span>
              </div>
            ) : paymentMethod === 'cash' && cart.length > 0 && isSufficientAmount ? (
              <div className="text-emerald-600 font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Cash verified — ready to finalize</span>
              </div>
            ) : (
              <span className="text-slate-400 text-[11px] italic">
                {cart.length === 0 ? 'Add items to begin sale' : 'Select payment & complete'}
              </span>
            )}
          </div>

          {/* Row 8: Checkout Button (h-14 py-0 with Retail Hotkey Badge) */}
          <button
            type="button"
            onClick={() => handleCheckout()}
            disabled={cart.length === 0 || isSubmitting || !isSufficientAmount}
            className="w-full h-14 py-0 bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-white text-lg font-black rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group relative"
          >
            <CheckCircle2 className="w-5 h-5 stroke-[3]" />
            <span>{isSubmitting ? 'PROCESSING SALE...' : 'Complete Sale / Checkout'}</span>
            <div className="flex items-center space-x-1">
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-sky-600/60 text-[10px] font-mono font-bold text-sky-100 border border-sky-400/40">
                Space
              </span>
              <ArrowRight className="w-5 h-5 stroke-[3] group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

        </div>

      </div>

      {/* High-Resolution Customer-Facing Bakong KHQR Modal */}
      <BakongKhqrModal
        isOpen={khqrModalOpen}
        onClose={() => setKhqrModalOpen(false)}
        totalUsd={grandTotal}
        totalKhr={grandTotalKhr}
        exchangeRate={exchangeRate}
        onPaymentSuccess={() => {
          setPaymentMethod('khqr');
          executeCheckout('khqr');
        }}
      />

      {/* Sale Confirmation Safety Barrier Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-sm overflow-hidden border border-slate-200 flex flex-col p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto shadow-2xs">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-800">Confirm Complete Sale?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Please verify transaction details before finalizing.
              </p>
            </div>

            {/* Summary Ticket Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Items in Cart:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {cart.reduce((s, i) => s + i.quantity, 0)} items
                </span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Payment Method:</span>
                <span className="font-black text-slate-800 uppercase tracking-wide">
                  {paymentMethod}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-700">Total to Pay:</span>
                <div className="text-right">
                  <div className="font-black text-slate-900 font-mono text-sm">{formatCurrency(grandTotal)}</div>
                  <div className="text-[10px] text-rose-500 font-bold font-mono">{formatKHR(grandTotalKhr)}</div>
                </div>
              </div>
              {paymentMethod === 'cash' && changeDueUsd > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200">
                  <span>Change Due:</span>
                  <span>{formatCurrency(changeDueUsd)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel (Esc)
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmModalOpen(false);
                  executeCheckout();
                }}
                disabled={isSubmitting}
                className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>Confirm (Enter)</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
