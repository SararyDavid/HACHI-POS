import React, { useState } from 'react';
import { 
  BarChart3, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Printer, 
  Search, 
  Filter, 
  Calendar, 
  CreditCard, 
  Banknote, 
  QrCode, 
  FileText, 
  Clock, 
  Layers,
  Tag,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  Check
} from 'lucide-react';
import { formatCurrency, formatKHR, formatDateTime } from '../utils/formatters';
import { refundSale } from '../api';
import { playScanBeep, playRegisterChime, playErrorBoop } from '../utils/audio';

export default function SalesHistory({ salesData, onReprintReceipt, onRefresh }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPayment, setFilterPayment] = useState('all');
  const [refundingInvoice, setRefundingInvoice] = useState(null);
  const [refundStatusMsg, setRefundStatusMsg] = useState('');

  const handleProcessRefund = async (invoiceNo) => {
    const reason = window.prompt(`Enter refund reason for Invoice #${invoiceNo}:`, 'Customer Return / RMA');
    if (!reason || !reason.trim()) return;

    setRefundingInvoice(invoiceNo);
    setRefundStatusMsg('');
    try {
      const res = await refundSale(invoiceNo, reason.trim());
      playRegisterChime();
      setRefundStatusMsg(`✓ Refund processed: ${res.message || 'Restored stock.'}`);
      setTimeout(() => setRefundStatusMsg(''), 4000);
      if (onRefresh) onRefresh();
    } catch (err) {
      playErrorBoop();
      alert(`Refund failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setRefundingInvoice(null);
    }
  };

  const sales = salesData?.sales || [];
  const metrics = salesData?.metrics || {
    total_revenue: 0,
    total_orders: 0,
    items_sold: 0,
    low_stock_count: 0
  };

  const avgTicket = metrics.total_orders > 0 ? (metrics.total_revenue / metrics.total_orders) : 0;

  // Filter sales list
  const filteredSales = sales.filter(sale => {
    const matchesPayment = filterPayment === 'all' || sale.payment_method.toLowerCase() === filterPayment.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesPayment;

    const matchesInvoice = sale.invoice_no?.toLowerCase().includes(q);
    const matchesCashier = sale.cashier_name?.toLowerCase().includes(q);
    const matchesShift = sale.shift_id && String(sale.shift_id).includes(q);
    const matchesItems = sale.items && sale.items.some(i => 
      i.product_name?.toLowerCase().includes(q) ||
      i.barcode?.toLowerCase().includes(q) ||
      (i.serial_number && i.serial_number.toLowerCase().includes(q))
    );

    return matchesPayment && (matchesInvoice || matchesCashier || matchesShift || matchesItems);
  });

  return (
    <div className="flex-1 p-4 max-w-7xl mx-auto w-full space-y-6">
      
      {/* ========================================================
          1. DAILY REVENUE & PERFORMANCE METRIC CARDS
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {formatCurrency(metrics.total_revenue)}
            </h3>
            <p className="text-[11px] font-bold text-sky-700">
              ≈ {formatKHR(Math.round((metrics.total_revenue || 0) * 4100))}
            </p>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1 mt-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>Real-time settled sales</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Invoices */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Orders / Invoices</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics.total_orders}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Completed retail tickets</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Hardware Items Sold */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hardware Items Sold</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics.items_sold}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Units dispensed</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Average Ticket Size */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Basket Size</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {formatCurrency(avgTicket)}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Revenue per customer</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* ========================================================
          2. FILTER & SEARCH TOOLBAR
          ======================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice #, S/N, barcode, item, cashier..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
          />
        </div>

        {/* Payment Method Filter */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs">
          {[
            { id: 'all', label: 'All Payments' },
            { id: 'cash', label: 'Cash' },
            { id: 'khqr', label: 'KHQR' },
            { id: 'card', label: 'Card' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setFilterPayment(p.id)}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterPayment === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

      </div>

      {/* ========================================================
          3. RECENT TRANSACTIONS TABLE
          ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Line Items Summary</th>
                <th className="py-3 px-3 text-center">Payment</th>
                <th className="py-3 px-4 text-right">Total (USD / KHR)</th>
                <th className="py-3 px-4 text-right">Reprint</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">No transaction records found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Sales will appear here automatically upon checkout.</p>
                  </td>
                </tr>
              ) : (
                filteredSales.map(sale => {
                  const itemsCount = sale.items ? sale.items.reduce((s, i) => s + i.quantity, 0) : 0;
                  const hasSerial = sale.items && sale.items.some(i => i.serial_number);

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                      
                      {/* Invoice No & Shift badge */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-1.5">
                            <span>{sale.invoice_no}</span>
                            {sale.status === 'refunded' && (
                              <span className="text-[10px] font-sans font-black text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                REFUNDED
                              </span>
                            )}
                          </div>
                          {sale.shift_id && (
                            <span className="text-[10px] font-sans text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded w-max mt-0.5 border border-amber-200">
                              Shift #{String(sale.shift_id).padStart(4, '0')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDateTime(sale.created_at)}</span>
                        </div>
                      </td>

                      {/* Cashier */}
                      <td className="py-3.5 px-4 text-slate-700 font-semibold whitespace-nowrap">
                        {sale.cashier_name || 'Admin'}
                      </td>

                      {/* Line Items Preview with S/N & Warranty */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-slate-800">
                              {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                            </span>
                            {hasSerial && (
                              <span className="px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 text-[10px] font-bold flex items-center space-x-1 border border-sky-200">
                                <Tag className="w-2.5 h-2.5 text-sky-600" />
                                <span>S/N Tracked</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 space-y-0.5">
                            {sale.items?.map((i, idx) => (
                              <div key={idx} className="truncate flex items-center space-x-1">
                                <span>{i.quantity}x {i.product_name}</span>
                                {i.serial_number && (
                                  <span className="font-mono text-[10px] text-sky-700 bg-slate-100 px-1 rounded border border-slate-200">
                                    S/N: {i.serial_number}
                                  </span>
                                )}
                                {i.warranty_period && (
                                  <span className="text-[10px] text-emerald-700">
                                    • {i.warranty_period}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {sale.payment_method === 'cash' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase">
                            <Banknote className="w-3 h-3 text-emerald-600" />
                            <span>Cash</span>
                          </span>
                        ) : sale.payment_method === 'khqr' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold uppercase">
                            <QrCode className="w-3 h-3 text-rose-600" />
                            <span>KHQR</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold uppercase">
                            <CreditCard className="w-3 h-3 text-sky-600" />
                            <span>Card</span>
                          </span>
                        )}
                      </td>

                      {/* Total Amount (Dual USD & KHR) */}
                      <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                        <div className="font-extrabold text-sm text-slate-900">
                          {formatCurrency(sale.total_amount)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold">
                          {formatKHR(sale.total_khr || Math.round(sale.total_amount * (sale.exchange_rate || 4100)))}
                        </div>
                      </td>

                      {/* Actions: Reprint & Refund */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => onReprintReceipt(sale)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 font-bold text-xs border border-slate-200 hover:border-sky-200 transition-colors cursor-pointer"
                          title="Open 80mm receipt preview & print"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Reprint</span>
                        </button>

                        {sale.status !== 'refunded' ? (
                          <button
                            onClick={() => handleProcessRefund(sale.invoice_no)}
                            disabled={refundingInvoice === sale.invoice_no}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                            title="Process RMA refund & return stock to inventory"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                            <span>{refundingInvoice === sale.invoice_no ? 'Refunding...' : 'Refund'}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-400 font-semibold text-[11px] border border-slate-200">
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Restocked</span>
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredSales.length} of {sales.length} transactions</span>
          <span className="font-semibold text-slate-700">Audit Trail & Transaction Ledger</span>
        </div>

      </div>

    </div>
  );
}
