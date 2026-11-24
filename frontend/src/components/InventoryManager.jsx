import React, { useState } from 'react';
import { 
  Package, 
  DollarSign, 
  AlertTriangle, 
  XCircle, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  ArrowUpDown,
  RefreshCw,
  PlusCircle,
  Tag
} from 'lucide-react';
import { formatCurrency, getStockStatus } from '../utils/formatters';
import { updateProduct, deleteProduct } from '../api';
import { playScanBeep, playErrorBoop } from '../utils/audio';

const CATEGORIES = ['All', 'Peripherals', 'Components', 'Tools', 'Storage', 'Cables', 'Services'];

export default function InventoryManager({ 
  products = [], 
  onRefresh, 
  onOpenAddModal, 
  onOpenEditModal 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low' | 'out' | 'in'
  const [copiedBarcode, setCopiedBarcode] = useState(null);
  const [restockingId, setRestockingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Copy Barcode to Clipboard
  const handleCopyBarcode = (barcode) => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 2000);
  };

  // Inline Quick Restock (+5 or +10 units)
  const handleQuickRestock = async (product, addQty) => {
    setRestockingId(product.id);
    try {
      const newStock = product.stock_qty + addQty;
      await updateProduct(product.id, { stock_qty: newStock });
      playScanBeep();
      if (onRefresh) onRefresh();
    } catch (err) {
      playErrorBoop();
      alert(`Restock failed: ${err.message}`);
    } finally {
      setRestockingId(null);
    }
  };

  // Delete product handler
  const handleDelete = async (id) => {
    try {
      await deleteProduct(id);
      playScanBeep();
      setDeleteConfirmId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      playErrorBoop();
      alert(`Delete failed: ${err.message}`);
    }
  };

  // KPI Calculations
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + (parseFloat(p.cost_price || 0) * parseInt(p.stock_qty || 0, 10)), 0);
  const lowStockItems = products.filter(p => p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold);
  const outOfStockItems = products.filter(p => p.stock_qty <= 0);

  // Filter products list
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    
    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold;
    else if (stockFilter === 'out') matchesStock = p.stock_qty <= 0;
    else if (stockFilter === 'in') matchesStock = p.stock_qty > p.low_stock_threshold;

    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(q) || 
      p.barcode.toLowerCase().includes(q) || 
      (p.brand && p.brand.toLowerCase().includes(q));

    return matchesCategory && matchesStock && matchesSearch;
  });

  return (
    <div className="flex-1 p-4 max-w-7xl mx-auto w-full space-y-6">
      
      {/* ========================================================
          1. KPI SUMMARY CARDS
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total SKUs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Products (SKUs)</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalProducts}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Catalog items tracked</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Total Inventory Cost Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inventory Asset Value</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalValue)}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Based on cost price</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Warning */}
        <div 
          onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          className={`bg-white p-5 rounded-2xl border shadow-soft flex items-center justify-between cursor-pointer transition-all ${
            stockFilter === 'low' ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20' : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Low Stock Warnings</p>
            <h3 className="text-2xl font-black text-amber-700 mt-1">{lowStockItems.length}</h3>
            <span className="text-[11px] text-amber-600 font-medium">Under threshold level</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Out of Stock Alert */}
        <div 
          onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
          className={`bg-white p-5 rounded-2xl border shadow-soft flex items-center justify-between cursor-pointer transition-all ${
            stockFilter === 'out' ? 'border-rose-400 bg-rose-50/40 ring-2 ring-rose-400/20' : 'border-slate-200 hover:border-rose-300'
          }`}
        >
          <div>
            <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Out of Stock</p>
            <h3 className="text-2xl font-black text-rose-700 mt-1">{outOfStockItems.length}</h3>
            <span className="text-[11px] text-rose-600 font-medium">Immediate restock required</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* ========================================================
          2. ACTION & FILTER TOOLBAR
          ======================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft space-y-3">
        
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter inventory by name, barcode, brand..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              title="Refresh inventory"
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product (Scan Box)</span>
            </button>
          </div>

        </div>

        {/* Categories & Stock Status Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          
          {/* Categories */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Stock Filter Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'in', label: 'In Stock' },
              { id: 'low', label: 'Low Stock' },
              { id: 'out', label: 'Out of Stock' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStockFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  stockFilter === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

        </div>

      </div>

      {/* ========================================================
          3. INVENTORY TABLE WITH INLINE QUICK RESTOCK
          ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            
            {/* Table Head */}
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Barcode / SKU</th>
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Cost</th>
                <th className="py-3 px-3 text-right">Selling</th>
                <th className="py-3 px-3 text-right">Margin</th>
                <th className="py-3 px-4 text-center">Stock Level</th>
                <th className="py-3 px-4 text-center">Quick Restock</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">No matching products found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try altering search keywords or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const stock = getStockStatus(product.stock_qty, product.low_stock_threshold);
                  const cost = parseFloat(product.cost_price || 0);
                  const sell = parseFloat(product.selling_price || 0);
                  const marginPct = sell > 0 ? (((sell - cost) / sell) * 100).toFixed(0) : 0;
                  const isRestocking = restockingId === product.id;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                      
                      {/* Barcode with Copy */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-800">{product.barcode}</span>
                          <button
                            onClick={() => handleCopyBarcode(product.barcode)}
                            title="Copy barcode"
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            {copiedBarcode === product.barcode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Product Name & Brand */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center space-x-2.5">
                          {product.image && (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-9 h-9 rounded-lg object-contain bg-slate-50 border border-slate-200 p-0.5 shrink-0"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-900 block truncate" title={product.name}>
                              {product.name}
                            </span>
                            <div className="flex items-center flex-wrap gap-1 mt-0.5">
                              {product.brand && (
                                <span className="text-[11px] text-slate-500 font-medium">{product.brand}</span>
                              )}
                              {product.warranty_period && (
                                <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded font-semibold border border-sky-200">
                                  {product.warranty_period}
                                </span>
                              )}
                              {Boolean(product.requires_serial) && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold border border-amber-200">
                                  S/N Tracked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                          {product.category}
                        </span>
                      </td>

                      {/* Cost Price */}
                      <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                        {formatCurrency(product.cost_price)}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(product.selling_price)}
                      </td>

                      {/* Margin % */}
                      <td className="py-3.5 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          marginPct >= 30 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {marginPct}%
                        </span>
                      </td>

                      {/* Stock Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${stock.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stock.dotClass}`}></span>
                          <span>{stock.status}</span>
                        </span>
                      </td>

                      {/* Inline Quick Restock Buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            disabled={isRestocking}
                            onClick={() => handleQuickRestock(product, 5)}
                            className="px-2 py-1 bg-slate-100 hover:bg-sky-100 hover:text-sky-700 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 transition-colors"
                            title="Restock 5 units immediately"
                          >
                            +5
                          </button>
                          <button
                            disabled={isRestocking}
                            onClick={() => handleQuickRestock(product, 10)}
                            className="px-2 py-1 bg-slate-100 hover:bg-sky-100 hover:text-sky-700 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 transition-colors"
                            title="Restock 10 units immediately"
                          >
                            +10
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onOpenEditModal(product)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                            title="Edit Product"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {deleteConfirmId === product.id ? (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(product.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredProducts.length} of {products.length} products</span>
          <span className="font-semibold text-slate-700">Hachi Tech Real-Time Inventory Control</span>
        </div>

      </div>

    </div>
  );
}
