import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  X, 
  QrCode, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Copy,
  Check
} from 'lucide-react';
import { MY_ABA_STATIC_QR, MERCHANT_INFO, generateDynamicKhqr } from '../utils/khqr';
import { formatCurrency, formatKHR } from '../utils/formatters';
import { simulateKhqrPayment, createKhqrPaymentSession, checkKhqrStatus } from '../api';

export default function BakongKhqrModal({
  isOpen,
  onClose,
  totalUsd,
  totalKhr,
  exchangeRate,
  onPaymentSuccess
}) {
  const [currency, setCurrency] = useState('USD'); // 'USD' | 'KHR'
  const [qrType, setQrType] = useState('dynamic'); // 'dynamic' | 'static'
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 min timer
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [sessionBillNo, setSessionBillNo] = useState(() => 'INV-' + Date.now().toString().slice(-6));
  const [serverKhqr, setServerKhqr] = useState('');
  const [activeMd5, setActiveMd5] = useState(null);
  const [isCheckingBakong, setIsCheckingBakong] = useState(false);

  const activeAmount = currency === 'USD' ? totalUsd : totalKhr;

  useEffect(() => {
    if (isOpen) {
      setSessionStartTime(Date.now());
      setSessionBillNo('INV-' + Date.now().toString().slice(-6));
      setServerKhqr('');
      setCountdown(300);
    }
  }, [isOpen]);

  // Register session on backend & smart-poll Bakong Open API (conserves 100 req/day quota)
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    let pollTimer = null;
    let pollCount = 0;
    const MAX_POLLS = 15; // Cap at 15 checks (~90 seconds) to save daily NBC quota

    const initBackendSession = async () => {
      try {
        const res = await createKhqrPaymentSession({
          amount: activeAmount,
          currency,
          billNo: sessionBillNo,
          mode: qrType
        });
        if (res?.data) {
          if (res.data.khqr) setServerKhqr(res.data.khqr);
          if (res.data.md5) {
            setActiveMd5(res.data.md5);

            // Poll Bakong verification endpoint gently every 6s
            pollTimer = setInterval(async () => {
              if (!active) return;
              pollCount++;
              if (pollCount > MAX_POLLS) {
                clearInterval(pollTimer);
                return;
              }
              try {
                const checkRes = await checkKhqrStatus(res.data.md5);
                if (checkRes?.confirmed) {
                  clearInterval(pollTimer);
                  if (onPaymentSuccess) onPaymentSuccess(checkRes.data);
                  onClose();
                }
              } catch (err) {}
            }, 6000);
          }
        }
      } catch (err) {
        console.warn('Backend session registration:', err);
      }
    };

    initBackendSession();

    return () => {
      active = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isOpen, activeAmount, currency, qrType, sessionBillNo]);

  // Use the exact QR string returned by the server so the MD5 is 100% synchronized!
  const qrString = useMemo(() => {
    if (qrType === 'static') return MY_ABA_STATIC_QR;
    if (serverKhqr) return serverKhqr;
    return generateDynamicKhqr({ 
      amount: activeAmount, 
      currency, 
      billNo: sessionBillNo,
      validityMinutes: 15,
      timestamp: sessionStartTime
    });
  }, [qrType, serverKhqr, activeAmount, currency, sessionBillNo, sessionStartTime]);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(300);
      return;
    }
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(qrString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      await simulateKhqrPayment({
        amount: activeAmount,
        currency
      });
      // onPaymentSuccess is also triggered via real-time WebSocket/SSE
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border-2 border-pink-100 overflow-hidden flex flex-col">
        
        {/* Header - Official Bakong Red Banner */}
        <div className="bg-[#E21A1A] text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-white text-[#E21A1A] font-black text-xs px-2 py-0.5 rounded tracking-widest shadow-2xs">
              KHQR
            </div>
            <span className="font-extrabold text-sm tracking-wide">BAKONG • ABA' PAY</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col items-center text-center space-y-3.5">
          
          {/* Merchant Info */}
          <div>
            <h3 className="text-base font-extrabold text-slate-800 leading-tight">
              {MERCHANT_INFO.name}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {MERCHANT_INFO.bank} • {MERCHANT_INFO.city}
            </p>
          </div>

          {/* Amount Display */}
          <div className="bg-pink-50/70 border border-pink-200/80 rounded-2xl px-4 py-2 w-full flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wider block text-left">
                Amount to Pay
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl font-black font-mono text-slate-900 leading-tight">
                  {currency === 'USD' ? formatCurrency(totalUsd) : formatKHR(totalKhr)}
                </span>
                <span className="text-xs font-bold text-pink-500 font-mono">
                  ({currency === 'USD' ? formatKHR(totalKhr) : formatCurrency(totalUsd)})
                </span>
              </div>
            </div>

            {/* Currency Selector */}
            <div className="flex bg-white rounded-xl p-0.5 border border-pink-200 shadow-2xs text-xs">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1 rounded-lg font-black transition-colors cursor-pointer ${
                  currency === 'USD' ? 'bg-pink-500 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('KHR')}
                className={`px-2.5 py-1 rounded-lg font-black transition-colors cursor-pointer ${
                  currency === 'KHR' ? 'bg-pink-500 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                KHR (៛)
              </button>
            </div>
          </div>

          {/* High-Resolution Scannable QR Code */}
          <div className="relative p-3 bg-white rounded-2xl border-2 border-slate-900 shadow-md flex items-center justify-center">
            <QRCodeSVG
              value={qrString}
              size={200}
              level="M"
              includeMargin={false}
              className="w-[200px] h-[200px]"
            />
            {/* Center KHQR Icon Stamp */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white p-1 rounded-md shadow border border-slate-300">
                <div className="bg-[#E21A1A] text-white font-black text-[9px] px-1.5 py-0.2 rounded tracking-wider">
                  KHQR
                </div>
              </div>
            </div>
          </div>

          {/* Live Real-Time Radar / Pulse Indicator */}
          <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-[11px]">Real-Time Payment Radar Active</span>
            </div>
            <span className="font-mono text-[11px] font-bold text-emerald-600">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>

          {/* QR Type Switcher (Dynamic vs Static) */}
          <div className="flex items-center justify-between w-full text-xs text-slate-500 px-1">
            <span className="font-semibold text-[11px]">Payload Mode:</span>
            <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setQrType('dynamic')}
                className={`px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors ${
                  qrType === 'dynamic' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
                title="Generates QR with pre-filled total bill amount"
              >
                Dynamic (Auto Amount)
              </button>
              <button
                type="button"
                onClick={() => setQrType('static')}
                className={`px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors ${
                  qrType === 'static' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
                title="Uses David Sarary official static QR string"
              >
                Static (User String)
              </button>
            </div>
          </div>

          {/* Scannable Apps List */}
          <p className="text-[10px] text-slate-400 leading-tight">
            Scan with <strong className="text-slate-600">ABA Mobile</strong>, <strong className="text-slate-600">Bakong</strong>, or any Cambodian Mobile Banking App.
          </p>

          {/* Primary Cashier Action: Manual Instant Confirm */}
          <button
            type="button"
            onClick={async () => {
              try {
                await simulateKhqrPayment({ amount: activeAmount, currency });
              } catch (e) {}
              if (onPaymentSuccess) onPaymentSuccess();
              onClose();
            }}
            className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-black text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>✓ Confirm Payment Received (Customer Paid)</span>
          </button>

          {/* Re-Check Bakong Switch Button */}
          <button
            type="button"
            onClick={async () => {
              if (!activeMd5 || isCheckingBakong) return;
              setIsCheckingBakong(true);
              try {
                const checkRes = await checkKhqrStatus(activeMd5);
                if (checkRes?.confirmed) {
                  if (onPaymentSuccess) onPaymentSuccess(checkRes.data);
                  onClose();
                } else {
                  alert(checkRes?.bakong?.responseMessage || 'Bakong: Transaction not found yet on NBC switch. If paying ABA-to-ABA, use Telegram or tap Confirm Payment.');
                }
              } catch (err) {
                alert('Bakong check failed: ' + err.message);
              } finally {
                setIsCheckingBakong(false);
              }
            }}
            disabled={isCheckingBakong}
            className="w-full py-1.5 px-3 bg-red-50 hover:bg-red-100 active:scale-[0.99] text-[#E21A1A] font-bold text-xs rounded-xl border border-red-200 flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingBakong ? 'animate-spin' : ''}`} />
            <span>{isCheckingBakong ? 'Querying NBC Bakong...' : 'Re-Check Bakong API Status'}</span>
          </button>

          {/* Secondary Action Buttons: Test Simulator & Copy String */}
          <div className="grid grid-cols-2 gap-2 w-full pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSimulate}
              disabled={isSimulating}
              className="py-1.5 px-2 bg-sky-100 hover:bg-sky-200 active:scale-95 text-sky-800 font-bold text-[11px] rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer shadow-2xs"
              title="Simulates real-time payment webhook arrival"
            >
              <Zap className="w-3 h-3 text-sky-600" />
              <span>{isSimulating ? 'Simulating...' : 'Test Auto-Push'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyRaw}
              className="py-1.5 px-2 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 flex items-center justify-center space-x-1 transition-all cursor-pointer shadow-2xs"
              title="Copy raw EMVCo payload string to clipboard"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
              <span>{copied ? 'Copied QR!' : 'Copy String'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
