import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Printer, 
  X, 
  CheckCircle2
} from 'lucide-react';
import { formatCurrency, formatKHR, formatDateTime } from '../utils/formatters';
import { MY_ABA_STATIC_QR, generateDynamicKhqr } from '../utils/khqr';

export default function ReceiptModal({ 
  sale, 
  isOpen, 
  onClose,
  autoPrint = false 
}) {
  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint]);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const storeInfo = {
    name: 'HACHI TECH & IT SOLUTIONS',
    address: 'Building 42, St. 2004, Phnom Penh',
    phone: '+855 23 888 999',
    taxId: 'VAT: KHM-2026-90412'
  };

  return (
    <>
      {/* ========================================================
          1. MODAL PREVIEW DIALOG (VISIBLE IN BROWSER UI)
          ======================================================== */}
      <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl shadow-modal w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Sale Receipt #{sale.invoice_no}</h3>
                <p className="text-xs text-slate-500">Transaction completed successfully</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-sky-100 text-sky-800 border border-sky-200">
                80mm Thermal Receipt
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors ml-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center items-start">
            
            {/* 80mm Thermal Paper Simulation (width 300px) */}
            <div className="w-[300px] bg-white rounded-lg shadow-md border border-slate-300 p-4 font-mono text-[11px] leading-tight text-black selection:bg-none">
                
                {/* Store Header */}
                <div className="text-center pb-2 border-b border-dashed border-slate-400">
                  <h2 className="font-extrabold text-[13px] tracking-wide uppercase">{storeInfo.name}</h2>
                  <p className="text-[10px] text-slate-700 mt-0.5">{storeInfo.address}</p>
                  <p className="text-[10px] text-slate-700">Tel: {storeInfo.phone}</p>
                  <p className="text-[9px] text-slate-600">{storeInfo.taxId}</p>
                </div>

                {/* Metadata */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
                  <div className="flex justify-between font-bold">
                    <span>INVOICE:</span>
                    <span>{sale.invoice_no}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Date:</span>
                    <span>{formatDateTime(sale.created_at)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-800 font-bold bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                    <span>Served By (Cashier):</span>
                    <span className="text-sky-700 font-black">{sale.cashier_name || 'Admin'}</span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="py-2 border-b border-dashed border-slate-400">
                  <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-slate-300 mb-1.5">
                    <span>ITEM / QTY</span>
                    <span>PRICE</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    {sale.items && sale.items.map((item, idx) => (
                      <div key={idx} className="flex flex-col border-b border-dotted border-slate-200 pb-1 last:border-b-0">
                        <div className="flex justify-between items-baseline">
                          <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                            {item.quantity}x {item.product_name}
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500 pl-3">
                          <span>@ {formatCurrency(item.unit_price)} each</span>
                          {item.warranty_period && (
                            <span className="text-sky-700 font-semibold">{item.warranty_period}</span>
                          )}
                        </div>
                        {item.serial_number && (
                          <div className="text-[9px] font-mono text-slate-700 pl-3 flex items-center space-x-1 mt-0.5">
                            <span className="font-bold text-slate-500">S/N:</span>
                            <span className="bg-slate-100 px-1 py-0.2 rounded font-semibold text-slate-800 tracking-wider">{item.serial_number}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(sale.subtotal)}</span>
                  </div>

                  {parseFloat(sale.discount) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Discount:</span>
                      <span>-{formatCurrency(sale.discount)}</span>
                    </div>
                  )}

                  {parseFloat(sale.tax) > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Tax / VAT:</span>
                      <span>+{formatCurrency(sale.tax)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[13px] font-black pt-1 border-t border-slate-800">
                    <span>TOTAL (USD):</span>
                    <span>{formatCurrency(sale.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-[12px] font-bold text-sky-800">
                    <span>TOTAL (KHR):</span>
                    <span>{formatKHR(sale.total_khr || Math.round(sale.total_amount * (sale.exchange_rate || 4100)))}</span>
                  </div>
                  <div className="text-[9px] text-right text-slate-500 italic">
                    Rate: 1 USD = {(sale.exchange_rate || 4100).toLocaleString()} KHR
                  </div>
                </div>

                {/* Tender & Payment Info */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span className="font-bold uppercase">{sale.payment_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Received:</span>
                    <span>
                      {formatCurrency(sale.amount_received)}
                      {parseFloat(sale.amount_received_khr || 0) > 0 && (
                        <span className="text-slate-500 ml-1">
                          (+{formatKHR(sale.amount_received_khr)})
                        </span>
                      )}
                    </span>
                  </div>
                  {sale.payment_method === 'cash' && (
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>Change Due:</span>
                      <div className="text-right">
                        <div>{formatCurrency(sale.change_due)}</div>
                        <div className="text-[9px] text-slate-600 font-normal">
                          {formatKHR(sale.change_due_khr || Math.round(sale.change_due * (sale.exchange_rate || 4100)))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* David Sarary Dynamic ABA KHQR Section (Cambodia Retail) */}
                <div className="my-2.5 p-2.5 bg-sky-50/50 border border-slate-300 rounded-lg text-center space-y-1.5">
                  <div className="flex items-center justify-center space-x-1.5">
                    <span className="bg-[#E21A1A] text-white font-black text-[9px] px-1.5 py-0.2 rounded tracking-wider">KHQR</span>
                    <span className="font-extrabold text-[11px] text-[#003B64] tracking-tight">ABA' PAY</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-800">
                    Merchant: David Sarary
                  </div>
                  <div className="flex justify-center items-center py-1">
                    <div className="relative p-1.5 bg-white border-2 border-slate-800 rounded-md shadow-xs inline-block">
                      <QRCodeSVG
                        value={generateDynamicKhqr({ 
                          amount: sale.total_amount, 
                          currency: 'USD', 
                          billNo: sale.invoice_no,
                          validityMinutes: 1440,
                          timestamp: sale.created_at ? new Date(sale.created_at).getTime() : Date.now()
                        }) || MY_ABA_STATIC_QR}
                        size={96}
                        level="M"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="bg-[#E21A1A] text-white font-black text-[7px] px-1 py-0.2 rounded shadow">KHQR</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono font-bold text-slate-800">
                    {formatCurrency(sale.total_amount)} • {formatKHR(sale.total_khr || Math.round(sale.total_amount * (sale.exchange_rate || 4100)))}
                  </div>
                  <p className="text-[8px] text-slate-500 leading-tight">
                    Scan with ABA Mobile or any Bakong App
                  </p>
                </div>

                {/* Barcode & Footer Message */}
                <div className="text-center pt-3 pb-1 space-y-1.5">
                  {/* Visual simulated Code-128 Barcode */}
                  <div className="flex justify-center items-center py-1">
                    <div className="h-10 w-44 bg-gradient-to-r from-black via-slate-700 to-black flex items-center justify-around px-2">
                      <div className="h-full w-[2px] bg-white"></div>
                      <div className="h-full w-[1px] bg-white"></div>
                      <div className="h-full w-[3px] bg-white"></div>
                      <div className="h-full w-[1px] bg-white"></div>
                      <div className="h-full w-[2px] bg-white"></div>
                      <div className="h-full w-[4px] bg-white"></div>
                      <div className="h-full w-[1px] bg-white"></div>
                      <div className="h-full w-[2px] bg-white"></div>
                    </div>
                  </div>
                  <p className="text-[9px] tracking-widest text-slate-600 font-bold">{sale.invoice_no}</p>

                  <p className="text-[9px] text-slate-700 pt-1 font-medium">
                    Thank you for choosing Hachi Tech!
                  </p>
                  <p className="text-[8px] text-slate-500">
                    Retain receipt & S/N for warranty verification
                  </p>
                  <p className="text-[8px] text-slate-400">
                    *** CUSTOMER RECEIPT COPY ***
                  </p>
                </div>

              </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Thermal Layout: <span className="font-semibold text-slate-800">80mm Paper / 48 Cols</span>
            </p>

            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold text-xs border border-slate-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center space-x-2 shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Print 80mm Receipt (Browser)</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================
          2. PRINT CONTAINER SPECIFICALLY FOR @MEDIA PRINT
          Rendered directly in the DOM, hidden on screen, printed by printer
          ======================================================== */}
      <div id="thermal-receipt-print-zone" style={{ display: 'none' }}>
        <div style={{ textAlign: 'center', paddingBottom: '6px', borderBottom: '1px dashed #000' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {storeInfo.name}
          </div>
          <div style={{ fontSize: '10px' }}>{storeInfo.address}</div>
          <div style={{ fontSize: '10px' }}>Tel: {storeInfo.phone}</div>
          <div style={{ fontSize: '9px' }}>{storeInfo.taxId}</div>
        </div>

        <div style={{ padding: '6px 0', borderBottom: '1px dashed #000', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>INVOICE:</span>
            <span>{sale.invoice_no}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Date:</span>
            <span>{formatDateTime(sale.created_at)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>Cashier:</span>
            <span>{sale.cashier_name || 'Admin'}</span>
          </div>
        </div>

        <div style={{ padding: '6px 0', borderBottom: '1px dashed #000', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '3px', marginBottom: '4px' }}>
            <span>ITEM</span>
            <span>TOTAL</span>
          </div>
          {sale.items && sale.items.map((item, idx) => (
            <div key={idx} style={{ marginBottom: '5px', paddingBottom: '3px', borderBottom: '1px dotted #ccc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>{item.quantity}x {item.product_name}</span>
                <span>{formatCurrency(item.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', paddingLeft: '8px', color: '#444' }}>
                <span>@ {formatCurrency(item.unit_price)} each</span>
                {item.warranty_period && <span>{item.warranty_period}</span>}
              </div>
              {item.serial_number && (
                <div style={{ fontSize: '9px', paddingLeft: '8px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  S/N: {item.serial_number}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '6px 0', borderBottom: '1px dashed #000', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal:</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {parseFloat(sale.discount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount:</span>
              <span>-{formatCurrency(sale.discount)}</span>
            </div>
          )}
          {parseFloat(sale.tax) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tax / VAT:</span>
              <span>+{formatCurrency(sale.tax)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
            <span>TOTAL (USD):</span>
            <span>{formatCurrency(sale.total_amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
            <span>TOTAL (KHR):</span>
            <span>{formatKHR(sale.total_khr || Math.round(sale.total_amount * (sale.exchange_rate || 4100)))}</span>
          </div>
          <div style={{ fontSize: '9px', textAlign: 'right', fontStyle: 'italic', color: '#555' }}>
            Rate: 1 USD = {(sale.exchange_rate || 4100).toLocaleString()} KHR
          </div>
        </div>

        <div style={{ padding: '6px 0', borderBottom: '1px dashed #000', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Payment Method:</span>
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{sale.payment_method}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Amount Received:</span>
            <span>
              {formatCurrency(sale.amount_received)}
              {parseFloat(sale.amount_received_khr || 0) > 0 && ` (+${formatKHR(sale.amount_received_khr)})`}
            </span>
          </div>
          {sale.payment_method === 'cash' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Change Due:</span>
              <div style={{ textAlign: 'right' }}>
                <div>{formatCurrency(sale.change_due)}</div>
                <div style={{ fontSize: '9px', fontWeight: 'normal' }}>
                  {formatKHR(sale.change_due_khr || Math.round(sale.change_due * (sale.exchange_rate || 4100)))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic ABA KHQR Section for 80mm Print */}
        <div style={{ textAlign: 'center', padding: '6px 0', borderBottom: '1px dashed #000' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold' }}>KHQR • ABA' PAY</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>David Sarary</div>
          <div style={{ margin: '4px auto', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QRCodeSVG
              value={generateDynamicKhqr({ 
                amount: sale.total_amount, 
                currency: 'USD', 
                billNo: sale.invoice_no,
                validityMinutes: 1440,
                timestamp: sale.created_at ? new Date(sale.created_at).getTime() : Date.now()
              }) || MY_ABA_STATIC_QR}
              size={80}
              level="M"
            />
          </div>
          <div style={{ fontSize: '9px', fontWeight: 'bold' }}>
            {formatCurrency(sale.total_amount)} ({formatKHR(sale.total_khr || Math.round(sale.total_amount * (sale.exchange_rate || 4100)))})
          </div>
          <div style={{ fontSize: '8px' }}>Scan with ABA Mobile / Bakong App</div>
        </div>

        {/* Barcode in Print Layout */}
        <div style={{ textAlign: 'center', paddingTop: '8px', fontSize: '9px' }}>
          {/* Visual simulated Code-128 Barcode */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4px 0' }}>
            <div style={{ height: '32px', width: '160px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px' }}>
              <div style={{ height: '100%', width: '2px', backgroundColor: '#fff' }}></div>
              <div style={{ height: '100%', width: '1px', backgroundColor: '#fff' }}></div>
              <div style={{ height: '100%', width: '3px', backgroundColor: '#fff' }}></div>
              <div style={{ height: '100%', width: '1px', backgroundColor: '#fff' }}></div>
              <div style={{ height: '100%', width: '2px', backgroundColor: '#fff' }}></div>
              <div style={{ height: '100%', width: '4px', backgroundColor: '#fff' }}></div>
              <div style={{ height: '100%', width: '1px', backgroundColor: '#fff' }}></div>
              <div style={{ height: '100%', width: '2px', backgroundColor: '#fff' }}></div>
            </div>
          </div>
          <div style={{ fontWeight: 'bold', letterSpacing: '2px', margin: '4px 0' }}>
            * {sale.invoice_no} *
          </div>
          <div>Thank you for choosing Hachi Tech!</div>
          <div style={{ fontSize: '8px' }}>Retain receipt & S/N for warranty verification</div>
          <div style={{ fontSize: '8px', marginTop: '4px' }}>*** CUSTOMER COPY ***</div>
        </div>
      </div>
    </>
  );
}
