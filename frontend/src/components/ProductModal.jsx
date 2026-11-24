import React, { useState, useEffect, useRef } from 'react';
import { X, Scan, Save, AlertCircle, Sparkles } from 'lucide-react';
import { createProduct, updateProduct } from '../api';
import { playScanBeep, playErrorBoop } from '../utils/audio';

const CATEGORIES = ['Peripherals', 'Components', 'Tools', 'Storage', 'Cables', 'Services'];

export default function ProductModal({ isOpen, onClose, productToEdit, onSaved }) {
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    category: 'Peripherals',
    brand: '',
    cost_price: '',
    selling_price: '',
    stock_qty: '10',
    low_stock_threshold: '5',
    warranty_period: '1 Year Warranty',
    requires_serial: false,
    image: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        setFormData({
          barcode: productToEdit.barcode || '',
          name: productToEdit.name || '',
          category: productToEdit.category || 'Peripherals',
          brand: productToEdit.brand || '',
          cost_price: productToEdit.cost_price || '',
          selling_price: productToEdit.selling_price || '',
          stock_qty: productToEdit.stock_qty || '0',
          low_stock_threshold: productToEdit.low_stock_threshold || '5',
          warranty_period: productToEdit.warranty_period || '7 Days Return',
          requires_serial: Boolean(productToEdit.requires_serial),
          image: productToEdit.image || ''
        });
      } else {
        setFormData({
          barcode: '',
          name: '',
          category: 'Peripherals',
          brand: '',
          cost_price: '',
          selling_price: '',
          stock_qty: '10',
          low_stock_threshold: '5',
          warranty_period: '1 Year Warranty',
          requires_serial: false,
          image: ''
        });
      }
      setError('');
      // Autofocus barcode field for instant retail scanning
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, productToEdit]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Calculate profit margin
  const cost = parseFloat(formData.cost_price) || 0;
  const selling = parseFloat(formData.selling_price) || 0;
  const margin = selling > 0 ? (((selling - cost) / selling) * 100).toFixed(1) : 0;
  const profit = (selling - cost).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.barcode.trim()) {
      setError('Please provide or scan a product barcode.');
      playErrorBoop();
      return;
    }
    if (!formData.name.trim()) {
      setError('Product name cannot be empty.');
      playErrorBoop();
      return;
    }
    if (isNaN(selling) || selling < 0) {
      setError('Please enter a valid selling price.');
      playErrorBoop();
      return;
    }

    setLoading(true);
    try {
      if (productToEdit) {
        await updateProduct(productToEdit.id, formData);
      } else {
        await createProduct(formData);
      }
      playScanBeep();
      onSaved();
      onClose();
    } catch (err) {
      playErrorBoop();
      setError(err.response?.data?.message || err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {productToEdit ? `Edit Product: ${productToEdit.name}` : 'Add New Hardware Product'}
              </h3>
              <p className="text-xs text-slate-500">
                {productToEdit ? 'Update product details and stock parameters' : 'Scan retail box barcode or enter SKU manually'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Barcode Field with Scanner Highlight */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <span>Retail Barcode (EAN/UPC/SKU)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-sky-600 font-semibold flex items-center space-x-1">
                <Scan className="w-3 h-3" />
                <span>USB Scanner ready</span>
              </span>
            </div>
            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="Scan barcode on box or type EAN-13..."
                required
                className="w-full bg-slate-50 border-2 border-sky-200 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:bg-white transition-all shadow-inner"
              />
              <div className="absolute right-3 top-2.5 pointer-events-none">
                <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded-full border border-sky-200">
                  AUTO-FOCUS
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Point your handheld USB barcode scanner at the packaging barcode to auto-populate.
            </p>
          </div>

          {/* Product Name */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Product Description / Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Logitech MX Master 3S Wireless Mouse"
              required
              className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white transition-all"
            />
          </div>

          {/* Category & Brand */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:bg-white transition-all"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Brand / Manufacturer
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g. Corsair, Samsung"
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Product Image URL */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Product Image URL (e.g. Unsplash or direct image link)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="url"
                name="image"
                value={formData.image || ''}
                onChange={handleChange}
                placeholder="https://images.unsplash.com/photo-..."
                className="flex-1 bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white transition-all"
              />
              {formData.image && (
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 p-0.5 shrink-0 overflow-hidden flex items-center justify-center">
                  <img
                    src={formData.image}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Pricing & Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Cost Price ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Selling Price ($ USD) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="selling_price"
                value={formData.selling_price}
                onChange={handleChange}
                placeholder="0.00"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white transition-all font-semibold"
              />
            </div>
          </div>

          {/* Live Margin Indicator */}
          {selling > 0 && (
            <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Estimated Gross Profit:</span>
              <div className="space-x-2">
                <span className="font-bold text-slate-900">${profit}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  margin > 25 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {margin}% Margin
                </span>
              </div>
            </div>
          )}

          {/* Stock Qty & Low Stock Alert Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Stock Quantity (Units)
              </label>
              <input
                type="number"
                min="0"
                name="stock_qty"
                value={formData.stock_qty}
                onChange={handleChange}
                placeholder="10"
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Low Stock Warning Level
              </label>
              <input
                type="number"
                min="1"
                name="low_stock_threshold"
                value={formData.low_stock_threshold}
                onChange={handleChange}
                placeholder="5"
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Warranty & S/N Tracking */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Warranty Period
              </label>
              <input
                type="text"
                name="warranty_period"
                value={formData.warranty_period}
                onChange={handleChange}
                placeholder="e.g. 1 Year Warranty"
                list="warranty-presets"
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:bg-white transition-all"
              />
              <datalist id="warranty-presets">
                <option value="7 Days Return" />
                <option value="1 Month Warranty" />
                <option value="3 Months Warranty" />
                <option value="6 Months Warranty" />
                <option value="1 Year Warranty" />
                <option value="2 Years Warranty" />
                <option value="3 Years Warranty" />
                <option value="Lifetime Warranty" />
                <option value="No Warranty" />
              </datalist>
            </div>
            <div className="flex flex-col justify-end pb-0.5">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  name="requires_serial"
                  checked={Boolean(formData.requires_serial)}
                  onChange={(e) => setFormData(prev => ({ ...prev, requires_serial: e.target.checked }))}
                  className="rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                />
                <span className="text-[11px] font-bold text-slate-800">Require S/N at Checkout</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold text-xs border border-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : productToEdit ? 'Save Changes' : 'Add to Inventory'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
