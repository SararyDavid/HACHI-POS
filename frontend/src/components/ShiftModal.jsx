import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  DollarSign, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Banknote, 
  QrCode, 
  CreditCard,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, formatKHR, formatDateTime } from '../utils/formatters';
import { startShift, closeShift, triggerZReportPrint } from '../api';
import { playScanBeep, playRegisterChime, playErrorBoop } from '../utils/audio';

export default function ShiftModal({ 
  isOpen, 
  onClose, 
  currentShift, 
  onShiftUpdated,
  cashierName = 'Alex S.'
}) {
  // Form State
  const [openingFloat, setOpeningFloat] = useState('100.00');
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [closedZReport, setClosedZReport] = useState(null);

  if (!isOpen) return null;

  // Handle Start Shift
  const handleStartShift = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await startShift({
        cashier_name: cashierName,
        opening_float: parseFloat(openingFloat) || 0,
        notes
      });
      playRegisterChime();
      onShiftUpdated();
      onClose();
    } catch (err) {
      playErrorBoop();
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Close Shift
  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!countedCash && countedCash !== '0') {
      setError('Please enter the counted cash amount in the drawer.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await closeShift({
        shift_id: currentShift.id,
        counted_cash: parseFloat(countedCash) || 0,
        notes
      });
      playScanBeep();
      setClosedZReport(res.data.shift);
      onShiftUpdated();
    } catch (err) {
      playErrorBoop();
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Print 80mm Z-Report Slip
  const handlePrintZReport = () => {
    window.print();
  };

  // Calculations for active shift
  const expCash = currentShift ? (parseFloat(currentShift.opening_float || 0) + parseFloat(currentShift.cash_sales || 0)) : 0;
  const numCounted = parseFloat(countedCash) || 0;
  const variance = numCounted - expCash;

  return (
    <>
      <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl shadow-modal w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-xl ${currentShift ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {currentShift ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {closedZReport ? 'Shift Closed - Z-Report' : currentShift ? `Shift #${currentShift.shift_no} (Active)` : 'Start New Cashier Shift'}
                </h3>
                <p className="text-xs text-slate-500">
                  {closedZReport ? 'Reconciliation completed' : currentShift ? 'Drawer cash reconciliation & end-of-day closing' : 'Enter opening cash drawer float to begin'}
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

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-4">
            
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {closedZReport ? (
              /* Z-Report Summary View */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-3">
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-emerald-600" />
                  <div>
                    <span className="font-bold block text-sm">Shift Successfully Closed!</span>
                    <span>Z-Report generated and recorded in audit ledger.</span>
                  </div>
                </div>

                {/* Z-Report Mini Slip Preview */}
                <div className="bg-slate-100 p-4 rounded-xl font-mono text-xs space-y-2 border border-slate-300">
                  <div className="text-center font-bold text-slate-800 border-b border-dashed border-slate-400 pb-2">
                    HACHI TECH - END OF DAY Z-REPORT
                    <p className="text-[10px] text-slate-500 font-normal">Shift #{closedZReport.shift_no}</p>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{closedZReport.cashier_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opening Float:</span>
                    <span>{formatCurrency(closedZReport.opening_float)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Sales:</span>
                    <span>{formatCurrency(closedZReport.cash_sales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>KHQR Sales:</span>
                    <span>{formatCurrency(closedZReport.khqr_sales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Card Sales:</span>
                    <span>{formatCurrency(closedZReport.card_sales)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-slate-300 pt-1">
                    <span>TOTAL SALES:</span>
                    <span>{formatCurrency(closedZReport.total_sales)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-dashed border-slate-400">
                    <span>Expected Drawer:</span>
                    <span>{formatCurrency(closedZReport.expected_cash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Counted Cash:</span>
                    <span>{formatCurrency(closedZReport.counted_cash)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-400">
                    <span>Variance:</span>
                    <span className={closedZReport.cash_difference >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {closedZReport.cash_difference >= 0 ? `+${formatCurrency(closedZReport.cash_difference)}` : formatCurrency(closedZReport.cash_difference)}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={handlePrintZReport}
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print 80mm Z-Report Slip</span>
                  </button>
                  <button
                    onClick={() => { setClosedZReport(null); onClose(); }}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : currentShift ? (
              /* Close Shift / Reconciliation Form */
              <form onSubmit={handleCloseShift} className="space-y-4">
                
                {/* Active Shift Performance Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Opening Float</span>
                    <span className="font-bold text-slate-800 text-sm font-mono">{formatCurrency(currentShift.opening_float)}</span>
                  </div>
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <span className="text-emerald-700 block text-[10px]">Cash Sales</span>
                    <span className="font-bold text-emerald-800 text-sm font-mono">{formatCurrency(currentShift.cash_sales)}</span>
                  </div>
                  <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    <span className="text-rose-700 block text-[10px]">KHQR Sales</span>
                    <span className="font-bold text-rose-800 text-sm font-mono">{formatCurrency(currentShift.khqr_sales)}</span>
                  </div>
                  <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-200">
                    <span className="text-sky-700 block text-[10px]">Total Sales</span>
                    <span className="font-bold text-sky-800 text-sm font-mono">{formatCurrency(currentShift.total_sales)}</span>
                  </div>
                </div>

                {/* Expected Cash in Drawer */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">System Expected Cash in Drawer</span>
                    <span className="text-[11px] text-amber-700">Opening Float (${currentShift.opening_float}) + Cash Sales (${currentShift.cash_sales})</span>
                  </div>
                  <span className="text-lg font-black text-amber-900 font-mono">
                    {formatCurrency(expCash)}
                  </span>
                </div>

                {/* Counted Cash Input */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Counted Physical Cash in Drawer ($ USD) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      placeholder="Enter physical cash counted..."
                      required
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-slate-900 focus:outline-none focus:bg-white transition-all"
                    />
                    {countedCash && (
                      <span className="absolute right-3 top-3 text-xs text-slate-400 font-mono">
                        ≈ {formatKHR(parseFloat(countedCash) * 4100)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Difference / Variance Display */}
                {countedCash !== '' && (
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    Math.abs(variance) < 0.01 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                      : variance > 0
                      ? 'bg-sky-50 text-sky-800 border-sky-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    <span>Drawer Variance:</span>
                    <span className="text-sm font-mono">
                      {Math.abs(variance) < 0.01 ? '✓ Balanced (Exact Match)' : variance > 0 ? `+${formatCurrency(variance)} (Overage)` : `${formatCurrency(variance)} (Shortage)`}
                    </span>
                  </div>
                )}

                {/* Shift Notes */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Closing Notes / Discrepancy Reason</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. $10 pulled for store supplies, drawer balanced."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                {/* Actions */}
                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || countedCash === ''}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{loading ? 'Closing...' : 'Close Shift & End Day'}</span>
                  </button>
                </div>

              </form>
            ) : (
              /* Start Shift Form */
              <form onSubmit={handleStartShift} className="space-y-4">
                
                <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800">
                  <span className="font-bold block mb-0.5">Opening Register Drawer</span>
                  <span>Enter the starting cash float currently inside the cash drawer before sales commence.</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Opening Cash Float ($ USD) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                      placeholder="100.00"
                      required
                      className="w-full bg-slate-50 border border-slate-300 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-slate-900 focus:outline-none focus:bg-white transition-all"
                    />
                    <span className="absolute right-3 top-3 text-xs text-slate-400 font-mono">
                      ≈ {formatKHR(parseFloat(openingFloat || 0) * 4100)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Shift Notes (Optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Standard morning float ($100)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>{loading ? 'Opening...' : 'Start Shift & Open Register'}</span>
                  </button>
                </div>

              </form>
            )}

          </div>

        </div>
      </div>

      {/* Printable Z-Report for @media print */}
      {closedZReport && (
        <div id="thermal-receipt-print-zone" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', paddingBottom: '6px', borderBottom: '1px dashed #000' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>HACHI TECH & IT SOLUTIONS</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2px' }}>END OF DAY Z-REPORT</div>
            <div style={{ fontSize: '9px' }}>Shift No: {closedZReport.shift_no}</div>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '1px dashed #000', fontSize: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cashier:</span>
              <span>{closedZReport.cashier_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Opened:</span>
              <span>{formatDateTime(closedZReport.opened_at)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Closed:</span>
              <span>{formatDateTime(closedZReport.closed_at)}</span>
            </div>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '1px dashed #000', fontSize: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>SALES BY PAYMENT:</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cash Sales:</span>
              <span>{formatCurrency(closedZReport.cash_sales)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>KHQR (Bakong):</span>
              <span>{formatCurrency(closedZReport.khqr_sales)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Card Sales:</span>
              <span>{formatCurrency(closedZReport.card_sales)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '3px', marginTop: '3px' }}>
              <span>GROSS SALES:</span>
              <span>{formatCurrency(closedZReport.total_sales)}</span>
            </div>
          </div>

          <div style={{ padding: '6px 0', borderBottom: '1px dashed #000', fontSize: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>DRAWER RECONCILIATION:</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Opening Float:</span>
              <span>{formatCurrency(closedZReport.opening_float)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>+ Cash Sales:</span>
              <span>{formatCurrency(closedZReport.cash_sales)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Expected Cash:</span>
              <span>{formatCurrency(closedZReport.expected_cash)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Counted Cash:</span>
              <span>{formatCurrency(closedZReport.counted_cash)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '3px', borderTop: '1px solid #000', paddingTop: '3px' }}>
              <span>VARIANCE:</span>
              <span>{closedZReport.cash_difference >= 0 ? `+${formatCurrency(closedZReport.cash_difference)}` : formatCurrency(closedZReport.cash_difference)}</span>
            </div>
          </div>

          <div style={{ paddingTop: '10px', fontSize: '9px', textAlign: 'center' }}>
            <div style={{ margin: '8px 0' }}>Cashier Signature: __________________</div>
            <div style={{ margin: '8px 0' }}>Manager Signature: __________________</div>
            <div>*** SHIFT AUDIT COPY ***</div>
          </div>
        </div>
      )}
    </>
  );
}
