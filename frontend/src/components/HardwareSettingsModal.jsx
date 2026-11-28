import React, { useState } from 'react';
import { 
  X, 
  Scan, 
  Volume2, 
  Printer, 
  Database, 
  Terminal, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Server
} from 'lucide-react';
import { playScanBeep, playErrorBoop, playRegisterChime } from '../utils/audio';
import { triggerEscPosPrint } from '../api';

export default function HardwareSettingsModal({ isOpen, onClose, dbInfo = {} }) {
  const [testBarcodeInput, setTestBarcodeInput] = useState('');
  const [scannerLogs, setScannerLogs] = useState([]);
  const [printerIp, setPrinterIp] = useState('192.168.1.200');
  const [printerPort, setPrinterPort] = useState(9100);
  const [printStatus, setPrintStatus] = useState(null);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleTestKey = (e) => {
    if (e.key === 'Enter') {
      const code = testBarcodeInput.trim();
      if (code) {
        playScanBeep();
        setScannerLogs(prev => [
          { code, time: new Date().toLocaleTimeString(), status: 'SUCCESS' },
          ...prev.slice(0, 4)
        ]);
        setTestBarcodeInput('');
      }
    }
  };

  const handleTestPrint = async () => {
    setIsSending(true);
    setPrintStatus(null);

    const mockSale = {
      invoice_no: 'TEST-ESC-POS-01',
      created_at: new Date().toISOString(),
      cashier_name: 'Alex S.',
      subtotal: 99.00,
      discount: 0.00,
      tax: 0.00,
      total_amount: 99.00,
      payment_method: 'cash',
      amount_received: 100.00,
      change_due: 1.00,
      items: [
        { product_name: 'Test Hardware Item', quantity: 1, unit_price: 99.00, subtotal: 99.00 }
      ]
    };

    try {
      const res = await triggerEscPosPrint(mockSale, { printerIp, printerPort });
      setPrintStatus({
        success: true,
        message: res.hardwareStatus || 'Generated ESC/POS 80mm test print payload successfully!'
      });
    } catch (err) {
      setPrintStatus({
        success: false,
        message: err.response?.data?.message || err.message
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Hardware & System Settings</h3>
              <p className="text-xs text-slate-500">Scanner, sound feedback, receipt printer, and database status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* 1. Database Connection Status */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-sky-600" />
                <span className="font-bold text-xs text-slate-800">Database Connection</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                dbInfo.type === 'mysql' 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {dbInfo.type === 'mysql' ? 'Connected (MySQL)' : 'Local Database'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {dbInfo.message || 'Database is working properly.'}
            </p>
            <div className="text-[11px] text-slate-500 font-mono bg-white p-2 rounded border border-slate-200">
              File: {dbInfo.dbName || 'hachi_pos_local.json'}
            </div>
          </div>

          {/* 2. USB Barcode Scanner Tester */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Scan className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-xs text-slate-800">Barcode Scanner Test</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                Ready to scan
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Plug in your barcode scanner and scan any item barcode here to test it.
            </p>
            <input
              type="text"
              value={testBarcodeInput}
              onChange={(e) => setTestBarcodeInput(e.target.value)}
              onKeyDown={handleTestKey}
              placeholder="Click here and scan a barcode..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 font-mono text-xs focus:outline-none focus:border-sky-500"
            />
            
            {scannerLogs.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Recent Scans</span>
                {scannerLogs.map((log, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] font-mono bg-white px-2 py-1 rounded border border-slate-200">
                    <span className="font-semibold text-slate-800">Code: {log.code}</span>
                    <span className="text-slate-400">{log.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Audio Feedback */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-sky-600" />
              <span className="font-bold text-xs text-slate-800">Sound Effects</span>
            </div>
            <p className="text-xs text-slate-500">
              Audio cues played for cashiers when scanning items and completing sales.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={playScanBeep}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Scan Beep
              </button>
              <button
                type="button"
                onClick={playErrorBoop}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:border-rose-500 hover:text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Error Sound
              </button>
              <button
                type="button"
                onClick={playRegisterChime}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:border-sky-500 hover:text-sky-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cash Register Chime
              </button>
            </div>
          </div>

          {/* 4. Network Receipt Printer */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center space-x-2">
              <Printer className="w-4 h-4 text-sky-600" />
              <span className="font-bold text-xs text-slate-800">Network Receipt Printer</span>
            </div>
            <p className="text-xs text-slate-500">
              Send a test print directly to a thermal printer connected to your local network.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] text-slate-500 block mb-0.5">Printer IP Address</label>
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Port (Default 9100)</label>
                <input
                  type="number"
                  value={printerPort}
                  onChange={(e) => setPrinterPort(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleTestPrint}
              disabled={isSending}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {isSending ? 'Sending print command...' : 'Print Test Receipt'}
            </button>

            {printStatus && (
              <div className={`p-2.5 rounded-lg text-xs ${
                printStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {printStatus.message}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
