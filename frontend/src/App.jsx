import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import PosTerminal from './components/PosTerminal';
import InventoryManager from './components/InventoryManager';
import SalesHistory from './components/SalesHistory';
import ReceiptModal from './components/ReceiptModal';
import ProductModal from './components/ProductModal';
import HardwareSettingsModal from './components/HardwareSettingsModal';
import ShiftModal from './components/ShiftModal';
import StatusFooter from './components/StatusFooter';
import PinLoginModal from './components/PinLoginModal';
import { fetchProducts, fetchSalesHistory, fetchHealth, fetchCurrentShift } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'inventory' | 'sales'
  
  // Cashier State
  const [cashier, setCashier] = useState({ name: 'Alex S.', role: 'Senior Cashier' });
  const [pinModalOpen, setPinModalOpen] = useState(false);

  // Data State
  const [products, setProducts] = useState([]);
  const [salesData, setSalesData] = useState({ sales: [], metrics: {} });
  const [currentShift, setCurrentShift] = useState(null);
  const [dbInfo, setDbInfo] = useState({ type: 'mysql', connected: true });
  const [loading, setLoading] = useState(true);

  // Modals State
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState({
    isOpen: false,
    sale: null,
    escposData: null,
    autoPrint: false
  });

  const [productModal, setProductModal] = useState({
    isOpen: false,
    product: null
  });

  const [hardwareModalOpen, setHardwareModalOpen] = useState(false);

  // Load Initial Data
  const loadInitialData = useCallback(async () => {
    try {
      const [prodRes, salesRes, healthRes, shiftRes] = await Promise.allSettled([
        fetchProducts(),
        fetchSalesHistory(),
        fetchHealth(),
        fetchCurrentShift()
      ]);

      if (prodRes.status === 'fulfilled' && prodRes.value?.data) {
        setProducts(prodRes.value.data);
      }
      if (salesRes.status === 'fulfilled' && salesRes.value?.data) {
        setSalesData(salesRes.value.data);
      }
      if (healthRes.status === 'fulfilled' && healthRes.value?.database) {
        setDbInfo(healthRes.value.database);
      }
      if (shiftRes.status === 'fulfilled' && shiftRes.value?.data) {
        setCurrentShift(shiftRes.value.data);
      }
    } catch (err) {
      console.error('Data initialization error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Refresh active shift
  const loadShiftData = async () => {
    try {
      const res = await fetchCurrentShift();
      setCurrentShift(res.data || null);
    } catch (err) {
      console.error('Failed to load shift:', err);
    }
  };

  // Refresh products and sales list
  const handleRefreshProducts = async () => {
    try {
      const res = await fetchProducts();
      if (res.data) setProducts(res.data);
      const sRes = await fetchSalesHistory();
      if (sRes.data) setSalesData(sRes.data);
      loadShiftData();
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  // Checkout Success Trigger
  const handleCheckoutSuccess = (receipt, escpos, autoPrint = true) => {
    setReceiptModal({
      isOpen: true,
      sale: receipt,
      escposData: escpos,
      autoPrint: !!autoPrint
    });
    handleRefreshProducts();
    loadShiftData();
  };

  // Reprint Receipt Trigger from Sales History
  const handleReprintReceipt = (sale) => {
    setReceiptModal({
      isOpen: true,
      sale,
      escposData: null,
      autoPrint: false
    });
  };

  // Add Product Modal Trigger
  const handleOpenAddProduct = () => {
    setProductModal({
      isOpen: true,
      product: null
    });
  };

  // Edit Product Modal Trigger
  const handleOpenEditProduct = (product) => {
    setProductModal({
      isOpen: true,
      product
    });
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-sky-50">
      
      {/* Top Application Navbar (Fixed height h-12 shrink-0) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cashierName={cashier.name}
        onOpenPinModal={() => setPinModalOpen(true)}
      />

      {/* Main Workspace: flex-1 flex overflow-hidden */}
      <main id="app-main-layout" className="flex-1 flex overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-slate-700">Loading Hachi Tech POS Terminal...</p>
              <p className="text-xs text-slate-400">Verifying database connections & catalog cache</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'pos' && (
              <PosTerminal
                products={products}
                onRefreshProducts={handleRefreshProducts}
                onCheckoutSuccess={handleCheckoutSuccess}
                currentShift={currentShift}
                cashierName={cashier.name}
              />
            )}

            {activeTab === 'inventory' && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <InventoryManager
                  products={products}
                  onRefresh={handleRefreshProducts}
                  onOpenAddModal={handleOpenAddProduct}
                  onOpenEditModal={handleOpenEditProduct}
                />
              </div>
            )}

            {activeTab === 'sales' && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <SalesHistory
                  salesData={salesData}
                  onReprintReceipt={handleReprintReceipt}
                  onRefresh={handleRefreshProducts}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Minimal System Status Footer */}
      <StatusFooter
        dbInfo={dbInfo}
        currentShift={currentShift}
        onOpenShiftModal={() => setShiftModalOpen(true)}
        onOpenSettings={() => setHardwareModalOpen(true)}
        cashierName={cashier.name}
        onOpenPinModal={() => setPinModalOpen(true)}
      />

      {/* 80mm Thermal Receipt Modal & Print Area */}
      <ReceiptModal
        isOpen={receiptModal.isOpen}
        sale={receiptModal.sale}
        escposData={receiptModal.escposData}
        autoPrint={receiptModal.autoPrint}
        onClose={() => setReceiptModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Product Add / Edit Modal */}
      <ProductModal
        isOpen={productModal.isOpen}
        productToEdit={productModal.product}
        onClose={() => setProductModal(prev => ({ ...prev, isOpen: false }))}
        onSaved={handleRefreshProducts}
      />

      {/* Shift Management & End-of-Day Z-Report Modal */}
      <ShiftModal
        isOpen={shiftModalOpen}
        currentShift={currentShift}
        onShiftUpdated={() => {
          loadShiftData();
          handleRefreshProducts();
        }}
        onClose={() => setShiftModalOpen(false)}
        cashierName={cashier.name}
      />

      {/* Hardware & Printer Diagnostics Modal */}
      <HardwareSettingsModal
        isOpen={hardwareModalOpen}
        dbInfo={dbInfo}
        onClose={() => setHardwareModalOpen(false)}
      />

      {/* Cashier PIN Lock / Authentication Modal */}
      <PinLoginModal
        isOpen={pinModalOpen}
        currentCashier={cashier.name}
        onClose={() => setPinModalOpen(false)}
        onLoginSuccess={(name, role) => setCashier({ name, role })}
      />

    </div>
  );
}
