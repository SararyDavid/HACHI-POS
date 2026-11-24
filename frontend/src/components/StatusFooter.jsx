import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  User, 
  Settings 
} from 'lucide-react';

export default function StatusFooter({ 
  dbInfo = {}, 
  currentShift = null, 
  onOpenShiftModal, 
  onOpenSettings,
  onOpenPinModal,
  cashierName = 'Alex S.' 
}) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="h-8 shrink-0 flex items-center justify-between px-4 bg-white/95 border-t border-sky-100 text-slate-400 text-xs z-20 select-none no-print">
      
      {/* Quiet IT & Hardware Background Indicators */}
      <div className="flex items-center space-x-3 text-[11px] text-slate-400">
        <button 
          onClick={onOpenSettings}
          className="flex items-center space-x-1.5 hover:text-slate-600 transition-colors cursor-pointer"
          title="Hardware: Scanner connected, Printer ready, ABA online"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Scanner Ready</span>
        </button>
        <span>•</span>
        <button 
          onClick={onOpenSettings}
          className="flex items-center space-x-1.5 hover:text-slate-600 transition-colors cursor-pointer"
          title="ESC/POS 80mm Network Printer: Ready"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Printer Ready</span>
        </button>
        <span>•</span>
        <button 
          onClick={onOpenSettings}
          className="hidden sm:flex items-center space-x-1.5 hover:text-slate-600 transition-colors cursor-pointer"
          title="Bakong / ABA KHQR Gateway: Online"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>ABA KHQR</span>
        </button>
        <span>•</span>
        <button 
          onClick={onOpenSettings}
          className="hidden md:flex items-center space-x-1.5 hover:text-slate-600 transition-colors cursor-pointer"
          title="Database: MySQL 8.0"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>{dbInfo.type === 'mysql' ? 'MySQL 8.0' : 'Local DB'}</span>
        </button>
      </div>

      {/* Right: Cashier, Shift & Live Clock */}
      <div className="flex items-center space-x-3 text-xs">
        
        {/* Shift Badge */}
        <button
          onClick={onOpenShiftModal}
          className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
            currentShift 
              ? 'text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200' 
              : 'text-pink-600 bg-pink-50 hover:bg-pink-100 border border-pink-200'
          }`}
          title="Shift Management"
        >
          <Clock className="w-3 h-3 text-pink-400" />
          <span>{currentShift ? `Shift #${currentShift.shift_no.slice(-4)}` : 'Open Shift'}</span>
        </button>

        <span className="text-slate-200">|</span>

        {/* Cashier Badge with Click to Switch */}
        <button
          onClick={onOpenPinModal}
          className="flex items-center space-x-1.5 text-slate-700 font-semibold hover:text-sky-600 cursor-pointer transition-colors"
          title="Switch Cashier"
        >
          <User className="w-3.5 h-3.5 text-sky-500" />
          <span>{cashierName}</span>
        </button>

        <span className="text-slate-200">|</span>

        {/* Live Clock */}
        <span className="font-mono text-slate-500 font-semibold hidden sm:inline">
          {timeStr}
        </span>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Settings & Diagnostics"
          className="p-1 text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

      </div>

    </footer>
  );
}
